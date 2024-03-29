---
title: rust写个操作系统——课程实验blogos移至armV8深度解析：实验八下 内存管理
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: 16886
date: 2022-06-09 03:21:00
updated: 2022-06-09 03:21:00
---
{% note info %}
> 你将在每个实验对应分支上都看到这句话，确保作者实验代码在被下载后，能在正确的环境中运行。

运行环境请参考: [lab1 环境搭建](https://noionion.top/adfdff.html)

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -semihosting
```
{% endnote %}

## 实验八 内存管理（下）

第二部分：非identity mapping映射（内核置于下半部分-原始地址，外设置于虚拟页-0xffffffff00000000开始的二级页表处）

--------

### 实验目的

实验指导书这么写的，全面理解分页式内存管理的基本方法以及访问页表，完成地址转换等的方法。这部分我也不太能搞懂，所以还是按它说的来吧。

--------

### 非identity mapping映射：块映射

`dentity mapping`毕竟过于简单，在实际的系统上并不实用，但也不是完全没有用途。如arm规定在启用地址映射时最好采用`identity mapping`。

我们首先重写链接脚本，重新调整内核内存的分布结构：

```linkerscript
__KERN_VMA_BASE = 0xfffffff000000000;
__PHY_DRAM_START_ADDR = 0x40000000;
__PHY_START_LOAD_ADDR = 0x40010000;

ENTRY(__PHY_START_LOAD_ADDR)
SECTIONS
{

    . = __KERN_VMA_BASE + __PHY_START_LOAD_ADDR;
    .text.boot : AT(__PHY_START_LOAD_ADDR) { KEEP(*(.text.boot)) }  /*ADDR(.text.boot) - __KERN_VMA_BASE*/

    .text :
        {
        KEEP(*(.text.boot))
        *(.text.exceptions)
        . = ALIGN(4096); /* align for exceptions_vector_table*/
        *(.text.exceptions_vector_table)
        *(.text)
        }
    . = ALIGN(0x1000);

    .rodata :  /*AT(ADDR(.rodata) - __KERN_VMA_BASE)*/ { *(.rodata*) }
    . = ALIGN(0x1000);

    .data : /*AT(ADDR(.data) - __KERN_VMA_BASE)*/ { *(.data*) }
    . = ALIGN(0x1000);

    .bss : /*AT(ADDR(.bss) - __KERN_VMA_BASE)*/  { *(.bss*)

    . = ALIGN(4096); /* align to page size */
    . += (4096 * 100); /* 栈的大小 */
    stack_top = .;
    LD_STACK_PTR = .;
    }
    . = ALIGN(0x1000);

    .pt : /*AT(ADDR(.pt) - __KERN_VMA_BASE)*/ /* 页表 */
    {
    . = ALIGN(4096); /* align to page size */
    LD_TTBR0_BASE = . - __KERN_VMA_BASE; /*页表*/
    . = . + 0x1000;

    LD_TTBR1_BASE = . - __KERN_VMA_BASE;
    . = . + 0x1000;

    LD_TTBR0_L2TBL = . - __KERN_VMA_BASE; /*二级页表*/
    . = . + 0x1000;

    LD_TTBR1_L2TBL = . - __KERN_VMA_BASE;
    . = . + 0x1000;
    }

    . = . + 0x1000;
    LD_KERNEL_END = . - __KERN_VMA_BASE;
}
```

相比于原先的链接脚本，我们重新定义了内核的入口为`0x40010000`处，并将内核的虚拟地址空间结构定义在了`0xfffffff000000000 + 0x40010000`。在mmu还未启用前，程序仍然会先进入`src/start.s`的`_start`函数部分（老师似乎使用了一些技巧使得入口不变，这边我不太理解，可能是恰当的增长内核结构空间使得`0x40080000`移到了`0x40010000`）。然后在链接脚本中对`.rodata`, `.data`, `.bss`, `.pt`段都进行了一次对齐操作。然后在接下来的4k内存空间中分别用于存储一级和二级页表。

但现在实现一二级页表还太过困难。我们先尝试将整个外设和内核的物理内存块映射到`0xfffffff000000000`开始的上半空间中，这步和直接映射的偏移很像，这里不再说明。

```assembly
/* 虚拟地址空间的上半部分处理 */
// entries of level1 page table
// 第一项 虚拟地址空间上半部分的首个1g映射到物理地址空间的0~1G，根据virt的定义为flash和外设，参见virt.c
ldr     x3, =0x0
lsr     x4, x3, #30
lsl     x5, x4, #30
ldr     x6, =PERIPHERALS_ATTR
orr     x5, x5, x6             // add flags
str     x5, [x2], #8

// 第二项，映射到内存（首先简单地实现块映射，没有问题了再进一步将其映射到页表）
ldr     x3, =__PHY_START_LOAD_ADDR
lsr     x4, x3, #30
lsl     x5, x4, #30
ldr     x6, =KERNEL_ATTR
orr     x5, x5, x6             // add flags
str     x5, [x2], #8
```

`PERIPHERALS_ATTR`属性设置同直接映射，而`KERNEL_ATTR`其实只是把直接映射的`IDENTITY_MAP_ATTR`换了个名，这里不再赘述。

这里我们需要考虑的是，我们已经把外设和内核映射到了内存的上半空间了，我们的下半空间是否还需要映射外设和内核？自行尝试后发现是需要的。原因在于，启用了mmu后，按照virt的机器启动历程，仍然会访问虚拟地址`0x40010000`而非`0xfffffff40010000`，因此虚拟地址 1G -2G 部分仍然要映射到物理内存相同的位置中。

我们使用gdb调试来进行验证，可以看到`0x0000000040010000 in ?? ()`，程序一开始访问的还是`0x40010000`。这是由机器所决定的，无法从内核层面进行更改。

我们在gdb中输入`b _start`，得到`Breakpoint 1 at 0xfffffff040010000`，发现程序其实已经放在了虚拟地址空间的上半页。那么程序是在什么阶段从`0x40010000`跳到了`0xfffffff40010000`？

回到我们实际一点的物理地址，无论是`0x40010000`还是`0xfffffff40010000`，物理地址上都是一样的，但是程序其实已经根据链接脚本把`_start`判断成虚拟地址的`0xfffffff40010000`（实际它也同时存在于`0x40010000`）。当我们不使用gdb时，他会自然而然的认为程序一开始就已经运行在`0xfffffff40010000`（实际上并不是，毕竟入口是`0x40010000`）。顺其自然的运行下去似乎没什么问题，程序就跑在上半空间了，下半空间的 1G - 2G 空间可以顺其自然的被丢弃。所以下半空间的映射内存是必要的，但它只被使用了一瞬间。

不过如果想尝试gdb单步运行会发现是不能的，gdb理解不能为什么0x40010000能继续往下跑（我不知道是不是它觉得下个地址非法）

所以最终我们的`src/start.s`如下：

```assembly
.extern LD_STACK_PTR

.section ".text.boot"
_start:
    ldr     x30, =LD_STACK_PTR
    mov   sp, x30

    // Initialize exceptions
    ldr     x0, =exception_vector_table
    msr     vbar_el1, x0
    isb

_setup_mmu:
    // Initialize translation table control registers
    ldr     x0, =TCR_EL1_VALUE
    msr     tcr_el1, x0
    ldr     x0, =MAIR_EL1_VALUE
    msr     mair_el1, x0

_setup_pagetable:
    // 因为采用的36位地址空间，所以是level1 page table
    // 注：这里内存上大下小
    ldr     x1, =LD_TTBR0_BASE
    msr     ttbr0_el1, x1           // 页表基地址TTBR0，指向内存下半
    ldr     x2, =LD_TTBR1_BASE
    msr     ttbr1_el1, x2           // 页表基地址TTBR1，指向内存上半

    /* 虚拟地址空间的下半部分直接映射 */
    // 第一项 虚拟地址0 - 1g（无内容）
    ldr     x5, =0x0                // add flags
    str     x5, [x1], #8

    // 第二项 虚拟地址1 - 2g（存放内核）
    ldr     x3, =__PHY_START_LOAD_ADDR
    lsr     x4, x3, #30             // 内核启动地址 / 1G
    lsl     x5, x4, #30             // 标记第30位为1
    ldr     x6, =KERNEL_ATTR
    orr     x5, x5, x6              // add flags
    str     x5, [x1], #8

    /* 虚拟地址空间的上半部分处理 */
    // entries of level1 page table
    // 第一项 虚拟地址空间上半部分的首个1g映射到物理地址空间的0~1G，根据virt的定义为flash和外设，参见virt.c
    ldr     x3, =0x0
    lsr     x4, x3, #30
    lsl     x5, x4, #30
    ldr     x6, =PERIPHERALS_ATTR
    orr     x5, x5, x6             // add flags
    str     x5, [x2], #8

    // 第二项，映射到内存（首先简单地实现块映射，没有问题了再进一步将其映射到页表）
    ldr     x3, =__PHY_START_LOAD_ADDR
    lsr     x4, x3, #30
    lsl     x5, x4, #30
    ldr     x6, =KERNEL_ATTR
    orr     x5, x5, x6             // add flags
    str     x5, [x2], #8

_enable_mmu:
    // Enable the MMU.
    mrs     x0, sctlr_el1
    orr     x0, x0, #0x1
    msr     sctlr_el1, x0
    dsb     sy                     // 检查前面内存操作是否执行完整
    isb

_start_main:
    bl      not_main

.equ PSCI_SYSTEM_OFF, 0x84000002
.globl system_off
system_off:
        ldr     x0, =PSCI_SYSTEM_OFF
        hvc     #0

.equ TCR_EL1_VALUE, 0x1B55C351C
/*
IPS   | b001    << 32 | 36bits address space - 64GB
TG1   | b10     << 30 | 4KB granule size for TTBR1_EL1
SH1   | b11     << 28 | 页表所在memory: Inner shareable
ORGN1 | b01     << 26 | 页表所在memory: Normal, Outer Wr.Back Rd.alloc Wr.alloc Cacheble
IRGN1 | b01     << 24 | 页表所在memory: Normal, Inner Wr.Back Rd.alloc Wr.alloc Cacheble
EPD   | b0      << 23 | Perform translation table walk using TTBR1_EL1
A1    | b1      << 22 | TTBR1_EL1.ASID defined the ASID
T1SZ  | b011100 << 16 | Memory region 2^(64-28) -> 0xffffffexxxxxxxxx
TG0   | b00     << 14 | 4KB granule size
SH0   | b11     << 12 | 页表所在memory: Inner Sharebale
ORGN0 | b01     << 10 | 页表所在memory: Normal, Outer Wr.Back Rd.alloc Wr.alloc Cacheble
IRGN0 | b01     << 8  | 页表所在memory: Normal, Inner Wr.Back Rd.alloc Wr.alloc Cacheble
EPD0  | b0      << 7  | Perform translation table walk using TTBR0_EL1
0     | b0      << 6  | Zero field (reserve)
T0SZ  | b011100 << 0  | Memory region 2^(64-28)
*/

.equ MAIR_EL1_VALUE, 0xFF440C0400
/*
                  INDX         MAIR
DEVICE_nGnRnE    b000(0)     b00000000
DEVICE_nGnRE     b001(1)     b00000100
DEVICE_GRE       b010(2)     b00001100
NORMAL_NC        b011(3)     b01000100
NORMAL           b100(4)     b11111111
*/

.equ PERIPHERALS_ATTR, 0x60000000000601
/*
UXN   | b1      << 54 | Unprivileged eXecute Never
PXN   | b1      << 53 | Privileged eXecute Never
AF    | b1      << 10 | Access Flag
SH    | b10     << 8  | Outer shareable
AP    | b01     << 6  | R/W, EL0 access denied
NS    | b0      << 5  | Security bit (EL3 and Secure EL1 only)
INDX  | b000    << 2  | Attribute index in MAIR_ELn，参见MAIR_EL1_VALUE
ENTRY | b01     << 0  | Block entry
*/

.equ KERNEL_ATTR, 0x40000000000711
/*
UXN   | b1      << 54 | Unprivileged eXecute Never
PXN   | b0      << 53 | Privileged eXecute Never
AF    | b1      << 10 | Access Flag
SH    | b11     << 8  | Inner shareable
AP    | b00     << 6  | R/W, EL0 access denied
NS    | b0      << 5  | Security bit (EL3 and Secure EL1 only)
INDX  | b100    << 2  | Attribute index in MAIR_ELn，参见MAIR_EL1_VALUE
ENTRY | b01     << 0  | Block entry
*/
```

由于我们更改了外设的地址，所以几个驱动文件中也要相应的更改外设的基址：

```rust
// interrupts.rs
//const GICD_BASE: u64 = 0x08000000;
//const GICC_BASE: u64 = 0x08010000;
// ==>
const GICD_BASE: u64 = 0xfffffff000000000 + 0x08000000;
const GICC_BASE: u64 = 0xfffffff000000000 + 0x08010000;

// pl011.rs
//pub const PL011REGS: *mut PL011Regs = (0x0900_0000) as *mut PL011Regs;
// ==>
pub const PL011REGS: *mut PL011Regs = (0xfffffff000000000u64 + 0x0900_0000) as *mut PL011Regs;


// pl061.rs
//pub const PL061REGS: *mut PL061Regs = (0x903_0000) as *mut PL061Regs;
// ==>
pub const PL061REGS: *mut PL061Regs = (0xfffffff000000000u64 + 0x903_0000) as *mut PL061Regs;
```

编译内核并运行

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -semihosting
```

屏幕上能够正常输出`[0] Hello from Rust!`并正常打点即说明成功实现了块映射。

### 非identity mapping映射：分页映射

实现了块映射后，我们可以进一步尝试用分页来进行内存管理。链接脚本我们在上一步就已经做好了一二级页表基址的定义。所以我们主要考虑如何更改块映射部分。

这里我们希望的是，`0xfffffff40010000`能通过分页完美的映射到物理内存的`0x40010000`部分。

首先下半肯定是保持不变的，上节已经说明过理由，主要考虑的是上半空间的1g开始的部分。

我们令1g开始的部分指向二级页表所在的地址段，二级页表每页指向 1G 的物理地址空间。

以`0xffffffff40010000`为例，一级页表大小为4k（由`TCR_EL1_VALUE`定义）

按其定义，则我们采用的为36位地址空间。

* `VA[63:36]`的每一位都为1，故采用`TTBR1`的页表基址

* 页表包含8个页表条目，使用`VA[24:22]`编制索引，故拆分出索引为`b000`

* `VA[21:0]`为物理地址位，范围为`0 - 2M(0x200000)`，即`0x10000`

不考虑物理地址位，我们需要把`b000`再经过一次二级页表转换。

而一级页表的每一项指向16M的空间（也就是8页二级表），故将块映射代码替换如下：

```assembly
    /*
    // 第二项，映射到内存（首先简单地实现块映射，没有问题了再进一步将其映射到页表）
    ldr     x3, =0x40010000
    lsr     x4, x3, #30
    lsl     x5, x4, #30
    ldr     x6, =KERNEL_ATTR
    orr     x5, x5, x6             // add flags
    str     x5, [x2], #8
    */

    // 第二项，映射到页表
    ldr     x3, =LD_TTBR1_L2TBL
    ldr     x4, =0xFFFFF000
    and     x5, x3, x4             // NSTable=0 APTable=0 XNTable=0 PXNTable=0.
    orr     x5, x5, 0x3            // Valid page table entry
    str     x5, [x2], #8

    // entries of level2 page table，二级页表共16M，详见aarch64-qemu.ld文件
    ldr     x3, =LD_TTBR1_L2TBL
    mov     x4, #8                 // 8个二级页表项
    ldr     x5, =KERNEL_ATTR       // 内核属性，可读写，可执行
    ldr     x7, =0x1
    add     x5, x5, x7, lsl #30    // 物理地址在1G开始的位置
    ldr     x6, =0x00200000        // 每次增加2M

_build_2nd_pgtbl:
    str     x5, [x3], #8           // 填入内容到页表项
    add     x5, x5, x6             // 下一项的地址增加2M
    subs    x4, x4, #1             // 项数减少1
    bne     _build_2nd_pgtbl
```

二级页表只取高36位后放入一级页表中，然后我们将物理内存 1G - 2G 部分放入二级页表中。汇编代码通过循环构建好8个页表项。

最后`src/start.s`为：

```assembly
.extern LD_STACK_PTR

.section ".text.boot"
_start:
    ldr     x30, =LD_STACK_PTR
    mov   sp, x30

    // Initialize exceptions
    ldr     x0, =exception_vector_table
    msr     vbar_el1, x0
    isb

_setup_mmu:
    // Initialize translation table control registers
    ldr     x0, =TCR_EL1_VALUE
    msr     tcr_el1, x0
    ldr     x0, =MAIR_EL1_VALUE
    msr     mair_el1, x0

_setup_pagetable:
    // 因为采用的36位地址空间，所以是level1 page table
    // 注：这里内存上大下小
    ldr     x1, =LD_TTBR0_BASE
    msr     ttbr0_el1, x1           // 页表基地址TTBR0，指向内存下半
    ldr     x2, =LD_TTBR1_BASE
    msr     ttbr1_el1, x2           // 页表基地址TTBR1，指向内存上半

    /* 虚拟地址空间的下半部分直接映射 */
    // 第一项 虚拟地址0 - 1g（无内容）
    ldr     x5, =0x0                // add flags
    str     x5, [x1], #8

    // 第二项 虚拟地址1 - 2g
    ldr     x3, =__PHY_START_LOAD_ADDR
    lsr     x4, x3, #30             // 内核启动地址 / 1G
    lsl     x5, x4, #30             // 标记第30位为1
    ldr     x6, =KERNEL_ATTR
    orr     x5, x5, x6              // add flags
    str     x5, [x1], #8

    /* 虚拟地址空间的上半部分处理 */
    // entries of level1 page table
    // 第一项 虚拟地址空间上半部分的首个1g映射到物理地址空间的0~1G，根据virt的定义为flash和外设，参见virt.c
    ldr     x3, =0x0
    lsr     x4, x3, #30
    lsl     x5, x4, #30
    ldr     x6, =PERIPHERALS_ATTR
    orr     x5, x5, x6             // add flags
    str     x5, [x2], #8

    /*
    // 第二项，映射到内存（首先简单地实现块映射，没有问题了再进一步将其映射到页表）
    ldr     x3, =0x40010000
    lsr     x4, x3, #30
    lsl     x5, x4, #30
    ldr     x6, =KERNEL_ATTR
    orr     x5, x5, x6             // add flags
    str     x5, [x2], #8
    */

    // 第二项，映射到页表
    ldr     x3, =LD_TTBR1_L2TBL
    ldr     x4, =0xFFFFF000
    and     x5, x3, x4             // NSTable=0 APTable=0 XNTable=0 PXNTable=0.
    orr     x5, x5, 0x3            // Valid page table entry
    str     x5, [x2], #8

    // entries of level2 page table，二级页表共16M，详见aarch64-qemu.ld文件
    ldr     x3, =LD_TTBR1_L2TBL
    mov     x4, #8                 // 8个二级页表项
    ldr     x5, =KERNEL_ATTR       // 内核属性，可读写，可执行
    ldr     x7, =0x1
    add     x5, x5, x7, lsl #30    // 物理地址在1G开始的位置
    ldr     x6, =0x00200000        // 每次增加2M

_build_2nd_pgtbl:
    str     x5, [x3], #8           // 填入内容到页表项
    add     x5, x5, x6             // 下一项的地址增加2M
    subs    x4, x4, #1             // 项数减少1
    bne     _build_2nd_pgtbl

_enable_mmu:
    // Enable the MMU.
    mrs     x0, sctlr_el1
    orr     x0, x0, #0x1
    msr     sctlr_el1, x0
    dsb     sy                     // 检查前面内存操作是否执行完整
    isb

_start_main:
    bl      not_main

.equ PSCI_SYSTEM_OFF, 0x84000002
.globl system_off
system_off:
        ldr     x0, =PSCI_SYSTEM_OFF
        hvc     #0

.equ TCR_EL1_VALUE, 0x1B55C351C
/*
IPS   | b001    << 32 | 36bits address space - 64GB
TG1   | b10     << 30 | 4KB granule size for TTBR1_EL1
SH1   | b11     << 28 | 页表所在memory: Inner shareable
ORGN1 | b01     << 26 | 页表所在memory: Normal, Outer Wr.Back Rd.alloc Wr.alloc Cacheble
IRGN1 | b01     << 24 | 页表所在memory: Normal, Inner Wr.Back Rd.alloc Wr.alloc Cacheble
EPD   | b0      << 23 | Perform translation table walk using TTBR1_EL1
A1    | b1      << 22 | TTBR1_EL1.ASID defined the ASID
T1SZ  | b011100 << 16 | Memory region 2^(64-28) -> 0xffffffexxxxxxxxx
TG0   | b00     << 14 | 4KB granule size
SH0   | b11     << 12 | 页表所在memory: Inner Sharebale
ORGN0 | b01     << 10 | 页表所在memory: Normal, Outer Wr.Back Rd.alloc Wr.alloc Cacheble
IRGN0 | b01     << 8  | 页表所在memory: Normal, Inner Wr.Back Rd.alloc Wr.alloc Cacheble
EPD0  | b0      << 7  | Perform translation table walk using TTBR0_EL1
0     | b0      << 6  | Zero field (reserve)
T0SZ  | b011100 << 0  | Memory region 2^(64-28)
*/

.equ MAIR_EL1_VALUE, 0xFF440C0400
/*
                  INDX         MAIR
DEVICE_nGnRnE    b000(0)     b00000000
DEVICE_nGnRE     b001(1)     b00000100
DEVICE_GRE       b010(2)     b00001100
NORMAL_NC        b011(3)     b01000100
NORMAL           b100(4)     b11111111
*/

.equ PERIPHERALS_ATTR, 0x60000000000601
/*
UXN   | b1      << 54 | Unprivileged eXecute Never
PXN   | b1      << 53 | Privileged eXecute Never
AF    | b1      << 10 | Access Flag
SH    | b10     << 8  | Outer shareable
AP    | b01     << 6  | R/W, EL0 access denied
NS    | b0      << 5  | Security bit (EL3 and Secure EL1 only)
INDX  | b000    << 2  | Attribute index in MAIR_ELn，参见MAIR_EL1_VALUE
ENTRY | b01     << 0  | Block entry
*/

.equ KERNEL_ATTR, 0x40000000000711
/*
UXN   | b1      << 54 | Unprivileged eXecute Never
PXN   | b0      << 53 | Privileged eXecute Never
AF    | b1      << 10 | Access Flag
SH    | b11     << 8  | Inner shareable
AP    | b00     << 6  | R/W, EL0 access denied
NS    | b0      << 5  | Security bit (EL3 and Secure EL1 only)
INDX  | b100    << 2  | Attribute index in MAIR_ELn，参见MAIR_EL1_VALUE
ENTRY | b01     << 0  | Block entry
*/
```

编译内核并运行

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -semihosting
```

屏幕上能够正常输出`[0] Hello from Rust!`并正常打点说明我们分页部分的代码不会导致内存错误，但是由于没有涉及后面的二级条目（我们只用了第0页），所以不能说明内存分页操作无误。
