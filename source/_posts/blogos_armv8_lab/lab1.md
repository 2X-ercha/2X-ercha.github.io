---
title: rust写个操作系统——课程实验blogos移至armV8深度解析：实验一 环境配置
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: adfdff
date: 2022-04-18 20:01:00
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

## 实验一 环境配置

这是实验的开始。由于我们的目标是编写一个操作系统，所以首先我们需要创建一个独立于操作系统的可执行程序，又称 **独立式可执行程序（freestanding executable）** 或 **裸机程序（bare-metal executable）** 。然后我们将此程序编译成为内核。

我们编写的独立程序得十分纯净，这意味着所有依赖于操作系统的库我们都不能使用。比如 std 中的大部分内容（io, thread, file system, etc.）都需要操作系统的支持，所以这部分内容我们不能使用。

但是，不依赖与操作系统的 rust 的语言特性 我们还是可以继续使用的，比如：迭代器、模式匹配、字符串格式化、所有权系统等。这使得 rust 依旧可以作为一个功能强大的高级语言，帮助我们编写操作系统。

最小化内核只干了两件事：能开机在屏幕上输出点东西，以及能保持运行。

--------

### 实验目的

因此实验一的代码也只让你干了这两件事。终上所述，实验一的目的在于：

1. 装好rust，装对版本

2. 装好`qemu`虚拟机来跑我们想运行的操作系统

3. 装好交叉编译用的调试工具`aarch64-none-elf-gdb`

4. 了解最小化内核（或者说裸机）是什么，它包含什么，并且我们要能在`qemu`里边跑的动它。

5. 学会用`gdb`远程调试这个内核，起码要会查看地址等等

知道了这个实验要干什么，我们可以一条一条开始学习了！

--------

### 环境安装

#### 安装rust

```bash
sudo apt-get install gcc
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
cargo install cargo-binutils rustfilt
```

全新安装 `rust`之后，鉴于实现操作系统时需要的各种并非出现在正式 `rust`版本中的特性（如内联汇编语句 `asm!()`)，以及实验要求的版本（这点在实验指导书中不是很明确的说明，`rust nightly`各版本代码差异极大，故在这里明确申明实验所用 `rust`版本）

```bash
rustup install nightly-2021-11-20
rustup default nightly-2021-11-20
```

此时输入 `rustc -V`应该看到如下字样：

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/1.png)

#### 为rust增加armv8支持

`cargo` 在编译内核时，可以用过 `--target <target triple>` 支持不同的系统。**目标三元组 (target triple)** 包含：cpu 架构、供应商、操作系统和 ABI 。

由于我们在编写自己的操作系统，所以所有目前的目标三元组都不适用。幸运的是，rust 允许我们用 JSON 文件定义自己的目标三元组。

```bash
rustup target add aarch64-unknown-none-softfloat
```

#### 安装QEMU模拟器

实验指导书中，希望我们参考文档去安装 qemu 。然后给出的文档却是如何在本地编译 qemu 。这并没有必要，ubuntu 的 apt 软件库之中已经提供了现成的模拟器软件。我们可以直接通过如下命令安装：

```bash
sudo apt-get install qemu qemu-system-arm
```

#### 安装交叉编译工具链 (aarch64) 及其调试工具

交叉编译让我们能在`x86-64`架构中编译出能在`arm`架构执行的程序（两种架构底层的逻辑是不同的，以常规的编译方式，我们在`x86-64`下编译的程序无法在`arm`架构机器平台运行。这也是为什么在许多软件中，他会有多种统一系统的下载安装包。

```bash
wget https://developer.arm.com/-/media/Files/downloads/gnu-a/10.2-2020.11/binrel/gcc-arm-10.2-2020.11-x86_64-aarch64-none-elf.tar.xz
tar -xf gcc-arm-10*
sudo cp gcc-arm-10*/bin/* /usr/local/bin/
rm -rf gcc-arm-10*
```

第三条的`copy`指令是将我们交叉编译的工具链完整的放进我们的环境中。实验指导书的该行代码只拷贝了必要的编译工具 **（很不幸的是它唯独忘记了把gdb调试工具拷贝到其中）**。在这里我选择完整拷贝交叉编译工具链。

--------

### 构建最小化内核

构建最小化内核，那必须要知道对于一个裸机状态的机器来讲什么状态才可以称之为最小。单单使用实验中的代码并解读它并不能让我们知道这一点，我们仍然不知道为什么那是最小。所以我在网上翻阅相关资料，对照实验，一步一步的向内核中添加必要代码。

#### 能跑起来的裸机程序尝试

试着创建一个`main`程序：新建项目

```bash
cargo new blogos_armv8 --bin --edition 2021
cd blogos_armv8
```

然后新建`src/main.rs`。此时`main`函数内容为空，因为我并不知道失去了标准库我还能在函数中使用什么代码。

```rust
#![no_std]

fn main() {}
```

然后`cargo build`进行构建，会产生两个报错：

```
error: language item required, but not found: `eh_personality`

error: `#[panic_handler]` function required, but not found
```

* `eh_personality`报错：

    > eh_personality 语义项(language item)用于标记函数：该函数在 堆栈展开(stack unwinding) 时被调用。当程序发生 panic 时，rust 会调用 堆栈展开 析构堆栈中的所有生存变量，达到释放内存的目的。但是这是一个复杂的过程，而且依赖于一些其他的库文件。所以我们只是简单的将其禁用：

    编辑`Cargo.toml`，在后边加入如下代码:

    ```toml
    # dev时禁用panic时栈展开
    [profile.dev]
    panic = "abort"

    # release时禁用panic时栈展开
    [profile.release]
    panic = "abort"
    ```

* `panic`报错：

    > 当程序出现异常时（程序并没有运行，但是这在编译阶段就会主动链接`panic`)，程序将会进入`panic`，此时需要调用相应函数。标准库有对应函数，但是由于我们使用了 `no_std` 属性，所以接下来我们需要自己实现一个函数。新建`src/panic.rs`

    ```cargo
    use core::panic::PanicInfo;

    #[panic_handler]
    fn on_panic(_info: &PanicInfo) -> ! {
        loop {}
    }
    ```

    然后在`main.rs`中引入`panic`

    ```rust
    mod panic;
    ```

    ~~由于程序 panic 后就应该结束，所以用 -> ! 表示该函数不会返回。由于目前的 OS 功能还很弱小，我们有希望系统保持开机状态，所以只能无限循环。~~

    这里之前找资料是这么说的。然后跟老师探讨时才发现错了。这里的`panic`里要用`loop`死循环处理属于是rust的特性。`panic`在rust中被规定必须是一个发散函数：

    发散函数（`diverging function`）是rust中的一个特性。发散函数不返回，它使用感叹号!作为返回类型表示。当程序调用发散函数时，该进程将直接进入崩溃（一般上来讲是发生程序员无法处理的错误时调用）。而如何在函数中表示其不返回？rust规定了以下三种情形：

    1. `panic!`以及基于它实现的各种函数/宏，比如`unimplemented!`、`unreachable!`；
    2. 无限循环`loop{}`；
    3. 进程退出函数`std::process::exit`以及类似的`libc`中的`exec`一类函数。

  由于我们不适用rust提供的标准库，故只能以死循环这样一种方式来编写我们的`panic`函数。而在我们的程序运行完后就结束了（并不保持开机），也不会调用panic。换言之，编写panic只是因为它是个必需的函数，但我们并不调用它。

--------

解决完如上几个报错后，再次`cargo build`，出现新的报错：

```
error: requires `start` lang_item
```

* `start`入口报错

    > 对于大多数语言，他们都使用了 运行时系统(runtime system) ，这导致 main 并不是他们执行的第一个函数。以 rust 语言为例：一个典型的 rust 程序会先链接标准库，然后运行 C runtime library 中的 crt0(C runtime zero) 设置 C 程序运行所需要的环境(比如：创建堆栈，设置寄存器参数等)。然后 C runtime 会调用 rust runtime 的 入口点(entry point) 。rust runtime 结束之后才会调用 main 。由于我们的程序无法访问 rust runtime 和 crt0 ，所以需要重写覆盖 crt0 入口点：

    新建`src/start.s`，告诉函数我们程序的进入入口在哪：

    ```assembly
    .globl _start
    .extern LD_STACK_PTR
    .section ".text.boot"

    _start:
            ldr     x30, =LD_STACK_PTR
            mov     sp, x30
            bl      not_main

    .equ PSCI_SYSTEM_OFF, 0x84000002
    .globl system_off
    system_off:
            ldr     x0, =PSCI_SYSTEM_OFF
            hvc     #0
    ```

    可以看到我们想告诉程序：我们这玩意的入口是`not_main`，程序要从`not_main`函数开始。然后修改`main.rs`，将主函数删除，替换成：

    ```rust
    #![no_main]

    #[no_mangle] // 不修改函数名
    pub extern "C" fn not_main() {}
    ```

    这里 `pub extern "C" fn not_main` 就是我们需要的 `start` 。 `#[no_mangle]` 属性用于防止改名称被混淆。

    由于 `start` 只能由操作系统或引导加载程序直接调用，不会被其他函数调用，所以不能够返回。如果需要离开该函数，应该使用 `exit` 系统调用。

    由于 start 函数无法返回或退出，自然也就不会调用 main 。所以将 main 函数删除，并且增加属性标签 `#![no_main]` 。

    然后修改程序启动例程：创建`aarch64-qemu.ld`，输入：

    ```ld
    ENTRY(_start)
    SECTIONS
    {
        . = 0x40080000;
        .text.boot : { *(.text.boot) }
        .text : { *(.text) }
        .data : { *(.data) }
        .rodata : { *(.rodata) }
        .bss : { *(.bss) }

        . = ALIGN(8);
        . = . + 0x4000;
        LD_STACK_PTR = .;
    }
    ```

    ENTRY(_start)中指明入口函数为_start函数，该函数在start.s中。

    通过 . = 0x40080000; 将程序安排在内存位置0x40080000开始的地方。

    链接脚本中的符号LD_STACK_PTR是全局符号，可以在程序中使用（如start.s中），这里定义的是栈底的位置。

--------

再次构建项目，却告诉我们汇编代码有问题：
```
error: unknown token in expression
```

* 汇编报错

    > 由于我们使用的是`arm`架构的汇编代码，自然用正常的编译方式这段汇编代码无法被正确解读。此时我们需要给`cargo`说明我们要编译的是给`arm`的代码：

    ```bash
    cargo build --target aarch64-unknown-none-softfloat
    ```

    为了方便，我们采用另一种方式：

    新建`.cargo/config.toml`，输入：

    ```toml
    [build]
    target = "aarch64-unknown-none-softfloat"
    rustflags = ["-C","link-arg=-Taarch64-qemu.ld", "-C", "target-cpu=cortex-a53", "-D", "warnings"]
    ```

    构建指令就仍然可以采用简短的`cargo build`

--------

再次尝试编译，出现如下错误：

```
error: linking with `rust-lld` failed: exit status: 1
```

* rust-lld报错：

    > 上节我们讲到需要构建原生目标三元组（而现有的三元组或多或少的都带有标准库），所以需要自己定义：

    新建`aarch64-unknown-none-softfloat.json`，配置目标平台相关参数，内容如下：

    ```json
    {
    "abi-blacklist": [
        "stdcall",
        "fastcall",
        "vectorcall",
        "thiscall",
        "win64",
        "sysv64"
    ],
    "arch": "aarch64",
    "data-layout": "e-m:e-i8:8:32-i16:16:32-i64:64-i128:128-n32:64-S128",
    "disable-redzone": true,
    "env": "",
    "executables": true,
    "features": "+strict-align,+neon,+fp-armv8",
    "is-builtin": false,
    "linker": "rust-lld",
    "linker-flavor": "ld.lld",
    "linker-is-gnu": true,
    "pre-link-args": {
        "ld.lld": ["-Taarch64-qemu.ld"]
    },
    "llvm-target": "aarch64-unknown-none",
    "max-atomic-width": 128,
    "os": "none",
    "panic-strategy": "abort",
    "relocation-model": "static",
    "target-c-int-width": "32",
    "target-endian": "little",
    "target-pointer-width": "64",
    "vendor": ""
    }
    ```

--------

最后进行一次构建：

![裸机构建成功](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/4.png)

使用如下命令运行裸机程序：

```bash
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

![运行成功](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/2.png)

--------

#### 程序的开始："Hello World"

绝大部分程序员的第一个程序都是在屏幕上输出类似于`"Hello World"`这样的字样。不例外的，我们也让这个最小化内核构建成功后能够打印`"Hello World"`：

修改`main.rs`，将`not_main`函数修改成下面所示代码，并引用`core`库中的`ptr`模块：

```rust
use core::ptr;

#[no_mangle] // 不修改函数名
pub extern "C" fn not_main() {
    const UART0: *mut u8 = 0x0900_0000 as *mut u8;
    let out_str = b"Hello World";
    for byte in out_str {
        unsafe {
            ptr::write_volatile(UART0, *byte);
        }
    }
}
```

> 其中`UART0`是异步串行接口，在这个程序中相当于控制台的外设输入输出。
>
> not_main函数通过`ptr::write_volatile`向串口输出字符.

这里相当于使用`ptr::write_volatile`直接向串口中循环输入字符。

再次构建并运行，可以看到：

![输出Hello World](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/3.png)

--------

### gdb调试

我们运行内核文件，是没办法像普通可执行文件那样，编译时增加`-g`指令然后`gdb`运行。因此我们要利用到`qemu`服务端功能，也就是开放端口让外部程序能够连接到`qemu`正在执行的程序中。

#### qemu 启动参数

下面是`qemu`的启动参数表：

```
`-hda file'        `-hdb file' `-hdc file' `-hdd file'
    使用 file  作为硬盘0、1、2、3镜像。
`-fda file'  `-fdb file'
    使用 file  作为软盘镜像，可以使用 /dev/fd0 作为 file 来使用主机软盘。
`-cdrom file'
    使用 file  作为光盘镜像，可以使用 /dev/cdrom 作为 file 来使用主机 cd-rom。
`-boot [a|c|d]'
    从软盘(a)、光盘(c)、硬盘启动(d)，默认硬盘启动。
`-snapshot'
    写入临时文件而不写回磁盘镜像，可以使用 C-a s 来强制写回。
`-m megs'
    设置虚拟内存为 msg M字节，默认为 128M 字节。
`-smp n'
    设置为有 n 个 CPU 的 SMP 系统。以 PC 为目标机，最多支持 255 个 CPU。
`-nographic'
    禁止使用图形输出。
其他：
    可用的主机设备 dev 例如：
        vc
            虚拟终端。
        null
            空设备
        /dev/XXX
            使用主机的 tty。
        file: filename
            将输出写入到文件 filename 中。
        stdio
            标准输入/输出。
        pipe：pipename
            命令管道 pipename。
        等。
    使用 dev 设备的命令如：
        `-serial dev'
            重定向虚拟串口到主机设备 dev 中。
        `-parallel dev'
            重定向虚拟并口到主机设备 dev 中。
        `-monitor dev'
            重定向 monitor 到主机设备 dev 中。
    其他参数：
        `-s'
            等待 gdb 连接到端口 1234。
        `-p port'
            改变 gdb 连接端口到 port。
        `-S'
            在启动时不启动 CPU， 需要在 monitor 中输入 'c'，才能让qemu继续模拟工作。
        `-d'
            输出日志到 qemu.log 文件。
```

可以对照启动命令，来进行启动命令的解释，这里不做详解。

看到参数中`-S`和`-s`和`-p`，我们能知道如何启动`qemu`的服务端状态，开放相关的端口（默认`1234`来另`gdb`连接。

#### 启动调试

为了与`qemu`配合进行源代码级别的调试，需要先让`qemu`进入**等待gdb调试器的接入**并且**还不能让qemu中的CPU执行**，因此启动qemu的时候，我们需要使用参数`-S –s`这两个参数来做到这一点，这相当于在**本地的1234端口**开启远程调试功能。

在qemu内核启动命令后加上`-S -s`:

```bash
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -S -s
```

内核不会马上运行，开始等待`gdb`的接管。由于我们是写给`arm`平台的操作系统，自然也需要`arm`平台的`gdb`调试工具。在项目根目录中，我们调用交叉编译工具链中的`aarch64-none-elf-gdb`工具来对程序进行调试。

保持`qemu`继续运行，新建一个终端后，在终端中输入：

```bash
aarch64-none-elf-gdb target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

在`gdb`调试界面中输入：

```gdb
(gdb) target remote localhost:1234
```

连接到`qemu`中正在准备开始执行的内核后，可以像正常的`gdb`调试去调试我们的内核。
