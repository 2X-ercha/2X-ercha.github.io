---
title: rust写个操作系统——课程实验blogos移至armV8深度解析：实验四 中断
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: a4c75e16
date: 2022-04-24 20:01:00
updated: 2022-05-21 21:19:00
---
{% note info %}
> 你将在每个实验对应分支上都看到这句话，确保作者实验代码在被下载后，能在正确的环境中运行。

运行环境请参考: [lab1 环境搭建](https://noionion.top/adfdff.html)

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -semihosting
```
{% endnote %}

## 实验四 中断

中断、异常和陷阱指令是操作系统的基石，现代操作系统就是由中断驱动的。实验四的目的在于深刻理解中断的原理和机制，掌握CPU访问设备控制器的方法，掌握Arm体系结构的中断机制和规范，实现时钟中断服务和部分异常处理等。

中断是一种硬件机制。借助于中断，CPU可以不必再采用轮询这种低效的方式访问外部设备。将所有的外部设备与CPU直接相连是不现实的，外部设备的中断请求一般经由中断控制器，由中断控制器仲裁后再转发给CPU。Arm采用的中断控制器叫做`GIC`，即`general interrupt controller`。`gic`包括多个版本，如`GICv1`（已弃用），`GICv2`，`GICv3`，`GICv4`。简单起见，我们实验将选用`GICv2`版本。

为了配置好`gicv2`中断控制器，我们需要阅读其技术参考手册，以及上一个实验中讲到的设备树中关于`gic`的内存映射范围、中断基本说明，为`gic`编写内核驱动。

另外，为了检验我们中断的成功运行，我们在这节实验中也一并为**linux高精度计时器**`timer`编写应用。`timer`的精确计时依赖着系统的时钟中断，可以作为中断发生的检验方式。

--------

### 实验目的

实验指导书是这么写的：

> 本实验的目的在于深刻理解中断的原理和机制，掌握CPU访问设备控制器的方法，掌握Arm体系结构的中断机制和规范，实现时钟中断服务和部分异常处理等。

但实际上，异常处理是在实验五才进行处理的，这个实验指编写了异常发生时的回调函数规范。因此实验目的如下：

1. 理解中断原理和机制

2. 掌握CPU访问设备控制器（这里是`GIC`）的方法，即为设备编写驱动和初始化等基本方法

3. 掌握Arm体系结构的中断机制和规范，即定义异常向量表

4. 掌握异常回调函数的写法

5. 了解`timer`计时器原理，实现时间中断服务。

--------

### 中断原理

#### 中断是什么

中断是一种硬件机制。简单的说，在cpu执行程序的过程中，突然发生异常 （包括复位、指令错误等等异常，中断只是异常其中一种），可以打断当前正在执行的程序，临时先处理比较紧急的事情，当处理完成了，再回到原来的程序继续执行。

借助于中断，CPU可以不必再采用轮询这种低效的方式访问外部设备。将所有的外部设备与CPU直接相连是不现实的，外部设备的中断请求一般经由中断控制器，由中断控制器仲裁后再转发给CPU。如下图所示Arm的中断系统。

![](https://os2022exps-doc.readthedocs.io/zh_CN/latest/_images/ARMGIC.png)

其中nIRQ是普通中断，nFIQ是快速中断。 Arm采用的中断控制器叫做GIC，即general interrupt controller。

#### 中断如何发生

首先，在一个cpu中 中断源有很多（比如gpio中断、定时器中断等等），那么为了管理这些中断，就需要一个中断控制器。
当发生中断时，相应的中断源会给中断控制器发出信号，中断控制器再给cpu发信号，最后cpu处理中断。

#### 中断的大概流程

1. 初始化：

    * 使能中断源（允许发生中断）

    * 中断控制器可以选择屏蔽或不屏蔽中断，设置中断优先级等

    * cpu 使能中断总开关

2. 中断跳转：

    * cpu 每执行完一条指令就会查看有无异常发生

    * 发生异常，cpu 分辩中断源

    * cpu 被强制跳转到中断向量表（汇编）中的跳转地址

    * 跳转到相应的中断服务函数

3. 中断处理回调函数：

    * 保护现场，保证当前执行的程序能完好返回（存储指令寄存器，以及存数据的寄存器等等各种寄存器，会采用压栈的方式）

    * 获取中断id（a7 架构，其中可能还需要切换处理器模式等等），根据id跳转到对应的中断处理函数。

    * 中断处理函数可以是我们自己编写的，代表的是中断发生后要处理的事情

    * 处理完成，返回中断服务函数。

    * 还原现场（将各个寄存器的值还回，指令寄存器需要-4后再返回，这里涉及到arm处理器的3级指令流水线，不做细讲）

### GIC内核驱动编写及调用

在实现我们的中断控制器驱动前，首先还是要先了解GIC。由于实验中只需要实现GICv2，故在此只对GICv2进行介绍。

#### 中断控制器GICv2

GIC 是联系外设中断和 CPU 的桥梁，也是各 CPU 之间中断互联的通道（也带有管理功能），它负责检测、管理、分发中断，可以做到：

1、使能或禁止中断；

2、把中断分组到Group0还是Group1（Group0作为安全模式使用连接FIQ ，Group1 作为非安全模式使用，连接IRQ ）；

3、多核系统中将中断分配到不同处理器上；

4、设置电平触发还是边沿触发方式（不等于外设的触发方式）；

5、虚拟化扩展。

  ARM CPU 对外的连接只有2 个中断： IRQ和FIQ ，相对应的处理模式分别是一般中断（IRQ ）处理模式和快速中断（FIQ ）处理模式。所以GIC 最后要把中断汇集成2 条线，与CPU 对接。

而在我们的实验中无需实现这么多功能。qemu模拟的virt机器作为单核系统，是不需要作过多的考虑的。而虚拟化扩展更非我们需要考虑实现的功能。

在gicv2中，gic由两个大模块`distributor`和`interface`组成：

1. distributor：主要负责中断源的管理、优先级、中断使能、中断屏蔽等，如下：

    * 中断分发，对于PPI,SGI是各个core独有的中断，不参与目的core的仲裁，SPI，是所有core共享的，根据配置决定中断发往的core。

    * 中断优先级的处理，将最高优先级中断发送给cpu interface。


    **寄存器使用 GICD_ 作为前缀。一个gic中，只有一个GICD。**  

2. cpu interface：要用于连接处理器，与处理器进行交互。将GICD发送的中断信息，通过IRQ,FIQ管脚，传输给core。

    **寄存器使用 GICC_ 作为前缀。每一个core，有一个cpu interface。**

3. 另外还有专门服务于虚拟中断的`virtual cpu interface`，这里并不考虑。

##### gic中断分发器(Distributor)

  分发器的主要的作用是检测各个中断源的状态，控制各个中断源的行为，分发各个中断源产生的中断事件到指定的一个或者多个CPU接口上。虽然分发器可以管理多个中断源，但是它总是把优先级最高的那个中断请求送往CPU接口。分发器对中断的控制包括：

* 打开或关闭每个中断。Distributor对中断的控制分成两个级别。一个是全局中断的控制`（GIC_DIST_CTRL）`。一旦关闭了全局的中断，那么任何的中断源产生的中断事件都不会被传递到 CPU interface。另外一个级别是对针对各个中断源进行控制`（GIC_DIST_ENABLE_CLEAR）`，关闭某一个中断源会导致该中断事件不会分发到 CPU interface，但不影响其他中断源产生中断事件的分发。

* 控制将当前优先级最高的中断事件分发到一个或者一组 `CPU interface`。当一个中断事件分发到多个 `CPU interface` 的时候，GIC 的内部逻辑应该保证只 `assert` 一个CPU。

* 优先级控制。

* `interrupt`属性设定。设置每个外设中断的触发方式：电平触发、边缘触发。

* `interrupt group`的设定。设置每个中断的 Group，其中 Group0 用于安全中断，支持 FIQ 和 IRQ，Group1 用于非安全中断，只支持 IRQ。

* 将SGI中断分发到目标CPU上。

* 每个中断的状态可见。

* 提供软件机制来设置和清除外设中断的pending状态。

##### gic中断接口(cpu interface)

CPU接口主要用于和CPU进行接口。主要功能包括：

* 打开或关闭 `CPU interface` 向连接的 `CPU assert` 中断事件。对于 ARM，CPU interface 和 CPU 之间的中断信号线是 nIRQCPU 和 nFIQCPU。如果关闭了中断，即便是 Distributor 分发了一个中断事件到 CPU interface，也不会 assert 指定的 nIRQ 或者 nFIQ 通知 Core。

* 中断的确认。Core 会向 `CPU interface` 应答中断（应答当前优先级最高的那个中断），中断一旦被应答，`Distributor` 就会把该中断的状态从 `pending` 修改成 `active` 或者 `pending and active`（这是和该中断源的信号有关，例如如果是电平中断并且保持了该 `asserted` 电平，那么就是 `pending and active`）。ack 了中断之后，CPU interface 就会 deassert `nIRQCPU` 和 `nFIQCPU` 信号线。

* 中断处理完毕的通知。当 `interrupt handler` 处理完了一个中断的时候，会向写 `CPU interface` 的寄存器通知 GIC CPU 已经处理完该中断。做这个动作一方面是通知 `Distributor` 将中断状态修改为 `deactive`，另外一方面，CPU interface 会 priority drop，从而允许其他的 pending 的中断向 CPU 提交。

* 为 CPU 设置中断优先级掩码。通过 `priority mask`，可以屏蔽掉一些优先级比较低的中断，这些中断不会通知到 CPU。

* 设置 CPU 的中断抢占（preemption）策略。

* 在多个中断事件同时到来的时候，选择一个优先级最高的通知 CPU。

关于`gicv2`就先介绍这么多。接下来我们开始一边实现我们需要实现的部分，一边继续介绍gicv2的细节。

#### gicv2内核驱动

##### 寄存器定义

编写驱动首先需要对寄存器以一些常量化的方式表示，以便我们更好的调用。阅读设备树中关于gicv2部分的代码：

```vts
intc@8000000 {
        phandle = <0x8001>;
        reg = <0x00 0x8000000 0x00 0x10000 0x00 0x8010000 0x00 0x10000>;
        compatible = "arm,cortex-a15-gic";
        ranges;
        #size-cells = <0x02>;
        #address-cells = <0x02>;
        interrupt-controller;
        #interrupt-cells = <0x03>;

        v2m@8020000 {
                phandle = <0x8002>;
                reg = <0x00 0x8020000 0x00 0x1000>;
                msi-controller;
                compatible = "arm,gic-v2m-frame";
        };
};
```

其中`reg`一行约定了gic的寄存器在内存中的映射范围，并结合gicv2的文档[ARM Generic Interrupt Controller](https://www.kernel.org/doc/Documentation/devicetree/bindings/interrupt-controller/arm%2Cgic.txt)可知：

*   GICD寄存器说明中：

    ```vts
    reg = <0x00 0x8000000 0x00 0x10000 0x00 0x8010000 0x00 0x10000>;
    ```

    约定：GICD寄存器映射到内存的位置为0x8000000，长度为0x10000， GICC寄存器映射到内存的位置为0x8010000，长度为0x10000

*   GICD中断说明中：

    ```vts
    #interrupt-cells = <0x03>;
    ```

    结合文档可知：约定：第一个cell为中断类型，0表示SPI，1表示PPI；第二个cell为中断号，SPI范围为`[0-987]`，PPI为`[0-15]`；第三个cell为flags，其中`[3:0]`位表示触发类型，`4`表示高电平触发，`[15:8]`为PPI的cpu中断掩码，每1位对应一个cpu，为1表示该中断会连接到对应的cpu。

由此我们知道了gicv2的寄存器基址及其范围。阅读文档[ARM Generic Interrupt Controller Architecture version 2.0 - Architecture Specification](https://documentation-service.arm.com/static/5f8ff196f86e16515cdbf969?token=)，可知寄存器的相对基址的映射地址及其功能。

其中寄存器表如下：

* GICD部分寄存器（文档P75）：

    ![GICD寄存器说明](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/gicd.png)

    新建`src/interrupts.rs`文件，定义寄存器表如下：

    ```rust
    //GICD寄存器基址
    const GICD_BASE: u64 = 0x08000000;

    //GICD实验所需寄存器
    const GICD_CTLR: *mut u32 = (GICD_BASE + 0x0) as *mut u32;
    const GICD_ISENABLER: *mut u32 = (GICD_BASE + 0x0100) as *mut u32;
    // const GICD_ICENABLER: *mut u32 = (GICD_BASE + 0x0180) as *mut u32;（此寄存器用于中断disable，此实验并未使用该函数，故注释
    const GICD_ICPENDR: *mut u32 = (GICD_BASE + 0x0280) as *mut u32;
    const GICD_IPRIORITYR: *mut u32 = (GICD_BASE + 0x0400) as *mut u32;
    const GICD_ICFGR: *mut u32 = (GICD_BASE + 0x0c00) as *mut u32;

    //GICD常量值
    const GICD_CTLR_ENABLE: u32 = 1; // Enable GICD
    const GICD_CTLR_DISABLE: u32 = 0; // Disable GICD
    const GICD_ISENABLER_SIZE: u32 = 32;
    // const GICD_ICENABLER_SIZE: u32 = 32; 注释理由同上
    const GICD_ICPENDR_SIZE: u32 = 32;
    const GICD_IPRIORITY_SIZE: u32 = 4;
    const GICD_IPRIORITY_BITS: u32 = 8;
    const GICD_ICFGR_SIZE: u32 = 16;
    const GICD_ICFGR_BITS: u32 = 2;
    ```

* GICC部分寄存器（文档P76)

    ![GICC寄存器](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/gicc.png)

    继续编辑`src/interrupts.rs`文件，定义寄存器表如下：

    ```rust
    //GICC寄存器基址
    const GICD_BASE: u64 = 0x08010000;

    //GICC实验所需寄存器
    const GICC_CTLR: *mut u32 = (GICC_BASE + 0x0) as *mut u32;
    const GICC_PMR: *mut u32 = (GICC_BASE + 0x0004) as *mut u32;
    const GICC_BPR: *mut u32 = (GICC_BASE + 0x0008) as *mut u32;

    //GICC常量值
    const GICC_CTLR_ENABLE: u32 = 1;  // Enable GICC
    const GICC_CTLR_DISABLE: u32 = 0; // Disable GICC
    const GICC_PMR_PRIO_LOW: u32 = 0xff; // 优先级掩码寄存器，中断优先级过滤器，较高优先级对应较低优先级字段值。
    const GICC_BPR_NO_GROUP: u32 = 0x00; // 优先级分组是将GICC_BPR（Binary PointRegister）分为两个域，组优先级（group priority）和组内优先级（subpriority）。当决定抢占（Preemption）的时候，组优先级相同的中断被视为一样的，不考虑组内优先级。那就意味着在每个优先级组内只能有一个中断被激活。组优先级又被称为抢占级别（preemption level）。这里令其无组优先级。
    ```


##### GIC初始化

阅读文档(P77)的4.1.5节，可以看到如何对GIC的初始化启用。在这我们以一个对于rust而言不安全的方式（直接写入寄存器）来实现

```rust
use core::ptr;

pub fn init_gicv2() {
    // 初始化Gicv2的distributor和cpu interface
    // 禁用distributor和cpu interface后进行相应配置
    unsafe {
        ptr::write_volatile(GICD_CTLR, GICD_CTLR_DISABLE);
        ptr::write_volatile(GICC_CTLR, GICC_CTLR_DISABLE);
        ptr::write_volatile(GICC_PMR, GICC_PMR_PRIO_LOW);
        ptr::write_volatile(GICC_BPR, GICC_BPR_NO_GROUP);
    }

    // 启用distributor和cpu interface
    unsafe {
        ptr::write_volatile(GICD_CTLR, GICD_CTLR_ENABLE);
        ptr::write_volatile(GICC_CTLR, GICC_CTLR_ENABLE);
    }
}
```

先禁用gicv2再进行初始化配置，是为了避免上一次的关机未对gicv2禁用后对初始化造成的影响。当对寄存器做好配置后我们再启用它。

对`GICC_PMR`优先级掩码寄存器配置初始值`0xff`。通过该寄存器中的值，可以屏蔽低优先级中断，这样它们就永远不会被触发，我们设置`0xff`，由于值`0xff`对应于最低优先级，`0x00`对应于最高优先级，故为接受所有中断。而对`GICC_BPR`设置为0,则最高优先级的挂起中断将被传递给处理器，而不考虑组优先级。

##### GIC相关函数

对于某个中断号，我们本身需要有多种函数对其作相应的处理。继续向代码中添加如下内容：

```rust
// 使能中断号为interrupt的中断
pub fn enable(interrupt: u32) {
    unsafe {
        ptr::write_volatile(
            GICD_ISENABLER.add((interrupt / GICD_ISENABLER_SIZE) as usize),
            1 << (interrupt % GICD_ISENABLER_SIZE)
        );
    }
}

// 禁用中断号为interrupt的中断
/*
pub fn disable(interrupt: u32) {
    unsafe {
        ptr::write_volatile(
            GICD_ICENABLER.add((interrupt / GICD_ICENABLER_SIZE) as usize),
            1 << (interrupt % GICD_ICENABLER_SIZE)
        );
    }
}*/

// 清除中断号为interrupt的中断
pub fn clear(interrupt: u32) {
    unsafe {
        ptr::write_volatile(
            GICD_ICPENDR.add((interrupt / GICD_ICPENDR_SIZE) as usize),
            1 << (interrupt % GICD_ICPENDR_SIZE)
        );
    }
}

// 设置中断号为interrupt的中断的优先级为priority
pub fn set_priority(interrupt: u32, priority: u32) {
    let shift = (interrupt % GICD_IPRIORITY_SIZE) * GICD_IPRIORITY_BITS;
    unsafe {
        let addr: *mut u32 = GICD_IPRIORITYR.add((interrupt / GICD_IPRIORITY_SIZE) as usize);
        let mut value: u32 = ptr::read_volatile(addr);
        value &= !(0xff << shift);
        value |= priority << shift;
        ptr::write_volatile(addr, value);
    }
}

// 设置中断号为interrupt的中断的属性为config
pub fn set_config(interrupt: u32, config: u32) {
    let shift = (interrupt % GICD_ICFGR_SIZE) * GICD_ICFGR_BITS;
    unsafe {
        let addr: *mut u32 = GICD_ICFGR.add((interrupt / GICD_ICFGR_SIZE) as usize);
        let mut value: u32 = ptr::read_volatile(addr);
        value &= !(0x03 << shift);
        value |= config << shift;
        ptr::write_volatile(addr, value);
    }
}
```

由于`disable`函数在本实验从未使用过，未避免rust安全性报错/警告，这里选择注释。`enable`函数则参照文档P93中`4.3.5`节编写，`disable`函数参照`4.3.6`节，`clear`函数参照`4.3.8`节，`set_priority`函数参照`4.3.11`节，`set_config`函数参照`4.3.13`节。具体不在这里说明。

自此，我们已经基本完成了一个简略版的gicv2内核驱动，基本上可以满足实验的需求。

### ArmV8中断机制及异常回调

ARMv8 架构定义了两种执行状态(Execution States)，AArch64 和 AArch32。分别对应使用64位宽通用寄存器或32位宽通用寄存器的执行。

![](https://os2022exps-doc.readthedocs.io/zh_CN/latest/_images/aarch64_exception_levels_2.svg)

上图所示为AArch64中的异常级别(Exception levels)的组织。可见AArch64中共有4个异常级别，分别为EL0，EL1，EL2和EL3。在AArch64中，Interrupt是Exception的子类型，称为异常。 AArch64 中有四种类型的异常:

* Sync（Synchronous exceptions，同步异常），在执行时触发的异常，例如在尝试访问不存在的内存地址时。

* IRQ （Interrupt requests，中断请求），由外部设备产生的中断

* FIQ （Fast Interrupt Requests，快速中断请求），类似于IRQ，但具有更高的优先级，因此 FIQ 中断服务程序不能被其他 IRQ 或 FIQ 中断。

* SError （System Error，系统错误），用于外部数据中止的异步中断。

当异常发生时，处理器将执行与该异常对应的异常处理代码。在ARM架构中，这些异常处理代码将会被保存在内存的异常向量表中。每一个异常级别（EL0，EL1，EL2和EL3）都有其对应的异常向量表。需要注意的是，与x86等架构不同，该表包含的是要执行的指令，而不是函数地址 3 。

异常向量表的基地址由VBAR_ELn给出，然后每个表项都有一个从该基地址定义的偏移量。 每个表有16个表项，每个表项的大小为128（0x80）字节（32 条指令）。 该表实际上由4组，每组4个表项组成。 分别是：

* 发生于当前异常级别的异常且SPSel寄存器选择SP0 4 ， Sync、IRQ、FIQ、SError对应的4个异常处理。

* 发生于当前异常级别的异常且SPSel寄存器选择SPx 4 ， Sync、IRQ、FIQ、SError对应的4个异常处理。

* 发生于较低异常级别的异常且执行状态为AArch64， Sync、IRQ、FIQ、SError对应的4个异常处理。

* 发生于较低异常级别的异常且执行状态为AArch32， Sync、IRQ、FIQ、SError对应的4个异常处理。

#### 异常向量表

阅读[AArch64 Exception and Interrupt Handling](https://developer.arm.com/documentation/100933/0100/AArch64-exception-vector-table)可得知以下异常向量表的地址定义：

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/exceAddr.png)

故我们新建`src/exceptions.s`，并定义异常向量表如下：

```assembly
.section .text.exceptions_vector_table
// Export a symbol for the Rust code to use.
.globl exception_vector_table
exception_vector_table:

.org 0x0000
    EXCEPTION_VECTOR el1_sp0_sync

.org 0x0080
    EXCEPTION_VECTOR el1_sp0_irq

.org 0x0100
    EXCEPTION_VECTOR el1_sp0_fiq

.org 0x0180
    EXCEPTION_VECTOR el1_sp0_error

.org 0x0200
    EXCEPTION_VECTOR el1_sync

.org 0x0280
    EXCEPTION_VECTOR el1_irq

.org 0x0300
    EXCEPTION_VECTOR el1_fiq

.org 0x0380
    EXCEPTION_VECTOR el1_error

.org 0x0400
    EXCEPTION_VECTOR el0_sync

.org 0x0480
    EXCEPTION_VECTOR el0_irq

.org 0x0500
    EXCEPTION_VECTOR el0_fiq

.org 0x0580
    EXCEPTION_VECTOR el0_error

.org 0x0600
    EXCEPTION_VECTOR el0_32_sync

.org 0x0680
    EXCEPTION_VECTOR el0_32_irq

.org 0x0700
    EXCEPTION_VECTOR el0_32_fiq

.org 0x0780
    EXCEPTION_VECTOR el0_32_error

.org 0x0800
```

并定义异常向量表使用的`EXCEPTION_VECTOR`宏和宏中用的`.exit_exception`函数：

```assembly
.equ CONTEXT_SIZE, 264

.section .text.exceptions

.macro EXCEPTION_VECTOR handler

  sub sp, sp, #CONTEXT_SIZE

  // store general purpose registers
  stp x0, x1, [sp, #16 * 0]
  stp x2, x3, [sp, #16 * 1]
  stp x4, x5, [sp, #16 * 2]
  stp x6, x7, [sp, #16 * 3]
  stp x8, x9, [sp, #16 * 4]
  stp x10, x11, [sp, #16 * 5]
  stp x12, x13, [sp, #16 * 6]
  stp x14, x15, [sp, #16 * 7]
  stp x16, x17, [sp, #16 * 8]
  stp x18, x19, [sp, #16 * 9]
  stp x20, x21, [sp, #16 * 10]
  stp x22, x23, [sp, #16 * 11]
  stp x24, x25, [sp, #16 * 12]
  stp x26, x27, [sp, #16 * 13]
  stp x28, x29, [sp, #16 * 14]

  // store exception link register and saved processor state register
  mrs x0, elr_el1
  mrs x1, spsr_el1
  stp x0, x1, [sp, #16 * 15]

  // store link register which is x30
  str x30, [sp, #16 * 16]
  mov x0, sp

  // call exception handler
  bl \handler

  // exit exception
  b .exit_exception
.endm

.exit_exception:
  // restore link register
  ldr x30, [sp, #16 * 16]

  // restore exception link register and saved processor state register
  ldp x0, x1, [sp, #16 * 15]
  msr elr_el1, x0
  msr spsr_el1, x1

  // restore general purpose registers
  ldp x28, x29, [sp, #16 * 14]
  ldp x26, x27, [sp, #16 * 13]
  ldp x24, x25, [sp, #16 * 12]
  ldp x22, x23, [sp, #16 * 11]
  ldp x20, x21, [sp, #16 * 10]
  ldp x18, x19, [sp, #16 * 9]
  ldp x16, x17, [sp, #16 * 8]
  ldp x14, x15, [sp, #16 * 7]
  ldp x12, x13, [sp, #16 * 6]
  ldp x10, x11, [sp, #16 * 5]
  ldp x8, x9, [sp, #16 * 4]
  ldp x6, x7, [sp, #16 * 3]
  ldp x4, x5, [sp, #16 * 2]
  ldp x2, x3, [sp, #16 * 1]
  ldp x0, x1, [sp, #16 * 0]

  // restore stack pointer
  add sp, sp, #CONTEXT_SIZE
  eret
```

并处理链接脚本`aarch64-qemu.ld`，为在`src/exceptions.s`中所定义的`exceptions_vector_table`选择位置，同时满足其4K对齐要求。

```ld
.text :
{
  KEEP(*(.text.boot))
  *(.text.exceptions)
  . = ALIGN(4096); /* align for exceptions_vector_table*/
  *(.text.exceptions_vector_table)
  *(.text)
}
```

然后在`src/start.s`中载入异常向量表`exception_vector_table`

```assembly
.section ".text.boot"
_start:
    ldr     x30, =LD_STACK_PTR
    mov   sp, x30

    // Initialize exceptions
    ldr     x0, =exception_vector_table
    msr     vbar_el1, x0
    isb

_start_main:
    bl      not_main
```

#### 异常处理回调函数

在`exceptions.s`中我们定义了`EXCEPTION_VECTOR`宏。在其中，每一类中断都对应一个处理函数，以`el1_sp0_sync`为例，其代码如下：

```rust
const EL1_SP0_SYNC: &'static str = "EL1_SP0_SYNC";

// 调用我们的print!宏打印异常信息，你也可以选择打印异常发生时所有寄存器的信息
fn catch(ctx: &mut ExceptionCtx, name: &str) {
    crate::print!(
        "\n  \
        {} @ 0x{:016x}\n\n ",
        name,
        ctx.elr_el1,
    );
}

#[no_mangle]
unsafe extern "C" fn el1_sp0_sync(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SP0_SYNC);
}
```

此处还算不上处理，准确的说是定义了一个函数来作为异常发生时的应答，具体如何处理我们将在下一个实验中看到。

完整的各类处理应答如下：在`src/interrupts.rs`中新增如下代码：

```rust
global_asm!(include_str!("exceptions.s"));

#[repr(C)]
pub struct ExceptionCtx {
    regs: [u64; 30],
    elr_el1: u64,
    spsr_el1: u64,
    lr: u64,
}

// 输出字符定义，便于观察到是发生某类异常
const EL1_SP0_SYNC: &'static str = "EL1_SP0_SYNC";
const EL1_SP0_IRQ: &'static str = "EL1_SP0_IRQ";
const EL1_SP0_FIQ: &'static str = "EL1_SP0_FIQ";
const EL1_SP0_ERROR: &'static str = "EL1_SP0_ERROR";
const EL1_SYNC: &'static str = "EL1_SYNC";
const EL1_IRQ: &'static str = "EL1_IRQ";
const EL1_FIQ: &'static str = "EL1_FIQ";
const EL1_ERROR: &'static str = "EL1_ERROR";
const EL0_SYNC: &'static str = "EL0_SYNC";
const EL0_IRQ: &'static str = "EL0_IRQ";
const EL0_FIQ: &'static str = "EL0_FIQ";
const EL0_ERROR: &'static str = "EL0_ERROR";
const EL0_32_SYNC: &'static str = "EL0_32_SYNC";
const EL0_32_IRQ: &'static str = "EL0_32_IRQ";
const EL0_32_FIQ: &'static str = "EL0_32_FIQ";
const EL0_32_ERROR: &'static str = "EL0_32_ERROR";

// 调用print!宏打印异常信息，你也可以选择打印异常发生时所有寄存器的信息
fn catch(ctx: &mut ExceptionCtx, name: &str) {
    crate::print!(
        "\n  \
        {} @ 0x{:016x}\n",
        name, ctx.elr_el1,
    );
}

// 异常处理函数
#[no_mangle]
unsafe extern "C" fn el1_sp0_sync(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SP0_SYNC);
}
#[no_mangle]
unsafe extern "C" fn el1_sp0_irq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SP0_IRQ);
}
#[no_mangle]
unsafe extern "C" fn el1_sp0_fiq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SP0_FIQ);
}
#[no_mangle]
unsafe extern "C" fn el1_sp0_error(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SP0_ERROR);
}
#[no_mangle]
unsafe extern "C" fn el1_sync(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_SYNC);
}
#[no_mangle]
unsafe extern "C" fn el1_irq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_IRQ);
}
#[no_mangle]
unsafe extern "C" fn el1_fiq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_FIQ);
}
#[no_mangle]
unsafe extern "C" fn el1_error(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_ERROR);
}
#[no_mangle]
unsafe extern "C" fn el0_sync(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_SYNC);
}
#[no_mangle]
unsafe extern "C" fn el0_irq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_IRQ);
}
#[no_mangle]
unsafe extern "C" fn el0_fiq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_FIQ);
}
#[no_mangle]
unsafe extern "C" fn el0_error(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_ERROR);
}
#[no_mangle]
unsafe extern "C" fn el0_32_sync(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_32_SYNC);
}
#[no_mangle]
unsafe extern "C" fn el0_32_irq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_32_IRQ);
}
#[no_mangle]
unsafe extern "C" fn el0_32_fiq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_32_FIQ);
}
#[no_mangle]
unsafe extern "C" fn el0_32_error(ctx: &mut ExceptionCtx) {
    catch(ctx, EL0_32_ERROR);
}
```

至此，我们已经在EL1级别定义了完整的中断处理框架，可以开始处理实际的中断了。

### Timer计时器的原理和时钟中断服务实现

#### Timer计时器介绍

任何AArch64 CPU都应该有一个通用计时器，但是有些板也可以包含外部计时器。arm架构对应的timer文档在[https://developer.arm.com/documentation/102379/0000/What-is-the-Generic-Timer-?lang=en](https://developer.arm.com/documentation/102379/0000/What-is-the-Generic-Timer-?lang=en)，里面介绍了timer通用计时器的一些说明。参照设备树中timer的部分

```dts
timer {
        interrupts = <0x01 0x0d 0x104 0x01 0x0e 0x104 0x01 0x0b 0x104 0x01 0x0a 0x104>;
        always-on;
        compatible = "arm,armv8-timer\0arm,armv7-timer";
};
```

设备树中说明，timer设备中包括4个中断。以第二个中断的参数`0x01 0x0e 0x104`为例，其指明该中断为PPI类型的中断，中断号14， 路由到第一个cpu，且高电平触发。但注意到PPI的起始中断号为16，所以实际上该中断在GICv2中的中断号应为`16 + 14 = 30`。我们将基于此，实现计时器触发中断。

这里也简单介绍一下`timer`的计时器：

在ARM体系结构中，处理器内部有通用计时器，通用计时器包含一组比较器，用来与系统计数器进行比较，一旦通用计时器的值小于等于系统计数器时便会产生时钟中断。timer寄存器如下：

* CNTPCT_EL0- physical counter value register

* CNTP_CTL_EL0- physical counter control register

* CNTP_TVAL_EL0 and CNTP_CVAL_EL0- two threshold value registers, 定时寄存器（TVAL） and 比较寄存器（CVAL）

* CNTFRQ_EL0- counter frequency register

1. 对于系统计数器来说，可以通过读取控制寄存器CNTPCT_EL0来获得当前的系统计数值（无论处于哪个异常级别）

2. **比较寄存器有64位，如果设置了之后，当系统计数器达到或超过了这个值之后（CVAL<系统计数器），就会触发定时器中断。**

3. **定时寄存器有32位，如果设置了之后，会将比较寄存器设置成当前系统计数器加上设置的定时寄存器的值（CVAL=系统计数器+TVAL）**

4. 每组定时器都还有一个控制寄存器（CTL），其只有最低三位有意义，其它的60位全是保留的，设置成0.

> * 0:ENABLE：是否打开定时器，使其工作；
>   
> * 1:IMASK：中断掩码，如果设置成1，则即使定时器是工作的，仍然不会发出中断；
>  
> * 2:ISTATUS：如果定时器打开的话，且满足了触发条件，则将这一位设置成1。

原理上讲，我们只需要在时钟开始时对定时器进行一次初始化，而在计时时间到达时，系统将会触发一次时钟中断，从而引发一次`el1_irq`异常。之后相对应的异常回调函数将调用输出，打印异常。

#### 时钟中断服务

了解了原理之后，我们尝试实现时钟中断。我们首先需要在系统启动时进行初始化，启用定时器并启用时钟中断（设置控制寄存器），然后设置定时。我们在`src/interrupts.rs`文件的`init_gicv2`初始化函数中新增如下内容：

```rust
// 电平触发
const ICFGR_LEVEL: u32 = 0;
// 时钟中断号30
const TIMER_IRQ: u32 = 30;

pub fn init_gicv2() {
    // ...

    set_config(TIMER_IRQ, ICFGR_LEVEL); //电平触发
    set_priority(TIMER_IRQ, 0); //优先级设定
    clear(TIMER_IRQ); //清除中断请求
    enable(TIMER_IRQ); //使能中断

    //配置timer
    unsafe {
        asm!("mrs x1, CNTFRQ_EL0"); //读取系统频率
        asm!("msr CNTP_TVAL_EL0, x1");  //设置定时寄存器
        asm!("mov x0, 1");
        asm!("msr CNTP_CTL_EL0, x0"); //设置控制器，令其enable=1, imask=0, istatus= 0
        asm!("msr daifclr, #2");
    }
}
```

~~在这里我们将这个函数设置成为了低电平触发，所以我们在主函数调用时需要将系统转入低电平的运行状态。~~

这里的`wfi`是使系统进入休眠状态，这里我们并不需要，低电平触发是指系统的每一个指令周期结束时触发。

由于我们的系统一执行完输出就结束了，我们希望它能够保持开机状态，故使用一个死循环来保证系统不会关机。编辑`src/main.rs`，结果如下：

```rust
// 不使用标准库
#![no_std]
// 不使用预定义入口点
#![no_main]
#![feature(global_asm)]
#![feature(asm)] // 为interrupts.rs和main.rs调用内联汇编

mod panic;
mod uart_console;
mod interrupts; // 引入中断

global_asm!(include_str!("start.s"));

#[no_mangle] // 不修改函数名
pub extern "C" fn not_main() {
    println!("[0] Hello from Rust!");
    interrupts::init_gicv2(); //初始化gicv2和timer
    /* 勘误
    unsafe {
        loop { // 轮询系统中断
            asm!("wfi"); // 将系统置于低电平运行状态
        }
    }*/
    loop {}
}
```

然后编译运行：

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

运行结果如下：

![引发el1_irq异常](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/timerACK.png)

系统不断打印触发了`el1_irq`信息。这里的循环是因为我们只接收了中断，而中断引发的异常并未被处理，寄存器未被复位所以不断触发异常。
