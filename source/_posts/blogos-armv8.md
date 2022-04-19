---
title: rust写个操作系统：课程实验blogos移至armV8深度解析（更新中）
categories: 教程
tags:
  - Course
  - os
  - rust
  - blogos
description: 对课程实验的试验记录和深度解析（也差不多是我的实验报告）
abbrlink: 16433
date: 2022-04-19 20:01:00
updated: 2022-04-19 20:01:00
---

## 前言

不能不说，我看着实验指导书给好的现成的代码，不知道这些代码到底在干什么。我陷入了沉思，作为一个想学习嵌入式系统的学生而言，我似乎不能从这个实验中学到些什么。

然而这些知识，理应是一个想做嵌入式的人应该有的，但看着现成代码再看注解，大部分情况下还是一头雾水。老师说理解原理，但又理解不能，于是去翻阅资料。只有一步步实现，才能更好的知道我们为什么要这么做。

很多的代码细节，我也仍然没办法去一行行解释。面对想学的东西，更多的还是保持求知欲和不厌其烦。

路漫漫其修远兮，吾将上下而求索，说的莫若如是。

--------

## 实验一 环境配置

这是实验的开始。由于我们的目标是编写一个操作系统，所以首先我们需要创建一个独立于操作系统的可执行程序，又称 **独立式可执行程序（freestanding executable）** 或 **裸机程序（bare-metal executable）** 。然后我们将此程序编译成为内核。

我们编写的独立程序得十分纯净，这意味着所有依赖于操作系统的库我们都不能使用。比如 std 中的大部分内容（io, thread, file system, etc.）都需要操作系统的支持，所以这部分内容我们不能使用。

但是，不依赖与操作系统的 rust 的语言特性 我们还是可以继续使用的，比如：迭代器、模式匹配、字符串格式化、所有权系统等。这使得 rust 依旧可以作为一个功能强大的高级语言，帮助我们编写操作系统。

最小化内核只干了两件事：能开机在屏幕上输出点东西，以及能保持运行。

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

    由于程序 panic 后就应该结束，所以用 -> ! 表示该函数不会返回。由于目前的 OS 功能还很弱小，我们有希望系统保持开机状态，所以只能无限循环。

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

--------

## 实验二 Hello World

上一个实验里，我们已经初步实现了让内核运行一开始输出`"Hello World"`，也初步了解到程序是如何调用硬件设备的寄存器。然而我们希望能在实验的每一个rust代码文件中，都能方便的调用`print`，而不是每一次输出都需要写一大串代码。

用函数模块化固然是个不错的方法，但当我们想调用它时就需要向`c`语言那样调用`stdio.h`头文件。这时候我们就需要了解`rust`本身的一个高级特性：宏

所以实验二我们将实现`rust`中最经典的宏：`print!`和`println!`，以便于后续的调试输出。

注：至于实验指导书中关于`virt`机器和设备树的部分，我会将其放到选做的实验三。实验三选做但是必要，是理解后续实验的关键。另外吐槽的是这节的实验指导书意外的还不错，我可以偷懒一点。

--------

## Write 实例实现和测试

### 实例实现

回顾实验一的`main.rs`代码，看看我们是如何实现输出`Hello World`的

```rust
const UART0: *mut u8 = 0x0900_0000 as *mut u8;
let out_str = b"Hello World";
for byte in out_str {
    unsafe {
        ptr::write_volatile(UART0, *byte);
    }
}
```

我们向`UART`串口循环写入我们想输出的字符。于是我们定义一个`Write`结构来实现输出单个字符和字符串：

新建`src/uart_console.rs`，定义如下结构：

```rust
//嵌入式系统使用串口，而不是vga，直接输出，没有颜色控制，不记录列号，也没有frame buffer，所以采用空结构
pub struct Writer;

//往串口寄存器写入字节和字符串进行输出
impl Writer {
    pub fn write_byte(&mut self, byte: u8) {
        const UART0: *mut u8 = 0x0900_0000 as *mut u8;
        unsafe {
            ptr::write_volatile(UART0, byte);
        }
    }

    pub fn write_string(&mut self, s: &str) {
        for byte in s.chars() {
            self.write_byte(byte as u8)
        }
    }
}
```

与`main.rs`中的输出进行对比，便显得很容易理解。我们为`Write`结构实现`core::fmt::Write trait(特性)`。继续向文件中加入如下代码：

```rust
impl core::fmt::Write for Writer {
  fn write_str(&mut self, s: &str) -> fmt::Result {
      self.write_string(s);
      Ok(())
  }
}
```

由于我们实现了 write_str ，核心库会帮我们自动实现 write_fmt 。进一步了解这部分内容，可以阅读 rust 官方文档中 [core::fmt::Write 部分](https://doc.rust-lang.org/core/fmt/trait.Write.html) 和 [rust 官方教程中 Traits](https://doc.rust-lang.org/book/ch10-02-traits.html) 部分。

基于Rust的`core::fmt`实现格式化控制，可以使我们方便地打印不同类型的变量。实现`core::fmt::Write`后，我们就可以使用Rust内置的格式化宏`write!`和`writeln!`，这使改结构具有其他语言运行时所提供的格式化控制能力。

--------

### 测试

向`main.rs`中加入测试函数，并修改`not_main`函数

```rust
#[no_mangle] // 不修改函数名
pub extern "C" fn not_main() {
    print_something();
}

//以下是测试代码部分
include!("uart_console.rs");
//引用Writer需要的控件
use core::fmt;
use core::fmt::Write;

//测试函数
pub fn print_something() {
    let mut writer = Writer{};

    // 测试Writer我们实现的两个函数
    writer.write_byte(b'H');
    writer.write_string("ello ");
    writer.write_string("Wörld!\n");
    writer.write_string("[0] Hello from Rust!");

    // 验证实现core::fmt::Write自动实现的方法
    let display: fmt::Arguments = format_args!("hello arguments!\n");
    writer.write_fmt(display).unwrap();
    // 使用write!宏进行格式化输出
    write!(writer, "The numbers are {} and {} \n", 42, 1.0/3.0).unwrap();
}
```

`cargo build`后并运行进行测试

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

![测试输出](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/5.png)

--------

## print!和println!封装

现在我们已经可以采用print_something函数通过串口输出字符了。但为了输出，我们需要两个步骤：

（1）创建Writer类型的实例

（2）调用实例的write_byte或write_string等函数。

为了方便在其他模块中调用，我们希望可以直接执行步骤（2）而不是首先执行上述步骤（1）再执行步骤（2）。

一般情况下可以通过将步骤（1）中的实例定义为static类型来实现

--------

### Write全局接口

我们尝试创建一个静态的WRITER变量：编辑`src/uart_console.rs`，新增：

```rust
pub static ref WRITER: Writer = Writer{};
```

我们尝试构建，却发生了错误。为了明白现在发生了什么，我们需要知道一点：一般的变量在运行时初始化，而静态变量在编译时初始化。Rust编译器规定了一个称为常量求值器`（const evaluator）`的组件，它应该在编译时处理这样的初始化工作。所以Rust暂不支持Writer这样类型的静态变量（编译时）初始化。

* 延迟初始化

    > 使用非常函数初始化静态变量是Rust程序员普遍遇到的问题。幸运的是，有一个叫做`lazy_static`的包提供了一个很棒的解决方案：它提供了名为`lazy_static!`的宏，定义了一个延迟初始化`（lazily initialized）`的静态变量；这个变量的值将**在第一次使用时计算，而非在编译时计算**。这时，变量的初始化过程将在运行时执行，任意的初始化代码——无论简单或复杂——都是能够使用的。

    现在我们引入`lazy_static`包：

    编辑`Cargo.toml`，向其中加入如下依赖：(在这里，由于程序不连接标准库，我们需要启用`spin_no_std`特性。)

    ```toml
    [dependencies.lazy_static]
    version = "1.0"
    features = ["spin_no_std"]
    ```

    然后将上述的静态变量`WRITER`的定义处套一层`lazy_static!`宏：

    ```rust
    use lazy_static::lazy_static;

    lazy_static! {
        pub static ref WRITER: Writer = Writer{};
    }
    ```

    再次编译可发现编译成功。然而，这个WRITER可能没有什么用途，因为它目前还是不可变变量`（immutable variable）`：这意味着我们无法向它写入数据，因为所有与写入数据相关的方法都需要实例的可变引用`&mut self`。
    
    一种解决方案是使用可变静态`（mutable static）`的变量，但所有对它的读写操作都被规定为不安全的（unsafe）操作，因为这很容易导致数据竞争或发生其它不好的事情——使用`static mut`极其不被赞成，甚至有一些提案认为应该将它删除。

* 自旋锁

    > 要定义同步的**内部可变**性，我们往往使用标准库提供的互斥锁类`Mutex`，它通过提供当资源被占用时将线程阻塞`（block）`的互斥条件`（mutual exclusion）`实现这一点；
    > 
    > 但我们初步的内核代码还没有线程和阻塞的概念，我们将不能使用这个类（而且我们也不能用标准库）。不过，我们还有一种较为基础的互斥锁实现方式——自旋锁`（spinlock）`。
    >
    > **自旋锁**并不会调用阻塞逻辑，而是**在一个小的无限循环中反复尝试获得这个锁**，也因此会一直占用CPU时间，直到互斥锁被它的占用者释放。

    简单的说，我们在从某个资源中读写数据知识，我们需要保证这个资源一直被我们所占用，**以免被其它的读写操作修改而导致结果错误，或引发一些其他的安全性问题**。（众所周知rust十分注重安全）

    向`Cargo.toml`加入如下依赖：
    ```toml
    [dependencies]
    spin = "0.9.2"
    ```

    然后再次修改我们的静态变量`WRITER`的定义：

    ```rust
    use lazy_static::lazy_static;
    use spin::Mutex;

    lazy_static! {
        pub static ref WRITER: Mutex<Writer> = Mutex::new(Writer { });
    }
    ```

    此时我们的`WRITER`才能可修改的全局静态变量，为我们`print!`和`println`宏的实现做好了准备。

---------

### 实现 print! 宏

现在我们可以开始实现`print!`和`println!`了。我们继续向`src\uart_console.rs`中写入：

```rust
#[doc(hidden)]
pub fn _print(args: fmt::Arguments) {
    use core::fmt::Write;
    WRITER.lock().write_fmt(args).unwrap();
}

#[macro_export]
macro_rules! print {
    ($($arg:tt)*) => ($crate::uart_console::_print(format_args!($($arg)*)));
}

#[macro_export]
macro_rules! println {
    () => ($crate::print!("\n"));
    ($($arg:tt)*) => ($crate::print!("{}\n", format_args!($($arg)*)));
}
```

函数`_print`和`print!`宏是从标准库中得到的，而`println!`宏则作了一点修改。

我们在每个使用的`print!`宏前面添加了`$crate`变量。这样我们在只需要使用`println!`时，不必也编写代码导入`print!`宏。

1. 首先是关于`_print`函数：

    > 我们在静态变量`WRITER`中引入了自旋锁，而`_print`函数调用时，将通过`.lock`来完成对`WRITER`锁的占有。同时`_print`函数并调用它的write_fmt方法。这个方法是从名为`Write`的特性中获得的，所以我们需要导入这个特性。额外的`unwrap()`函数将在打印不成功的时候`panic`；但实际上我们的`write_str`总是返回Ok，这种情况不应该发生。
    > 
    > 考虑到这个函数是一个私有的实现细节，我们添加一个doc(hidden)属性，防止它在生成的文档中出现。（事实上这个实验也不会去生成文档）

2. 根据声明宏的定义，我们为两个宏都添加了#[macro_export]属性，这样在包的其它地方也可以使用它们。
    
    > 需要注意的是，这将占用包的根命名空间`（root namespace）`，所以我们调用不能通过`use crate::uart_console::print`来导入，也不能直接通过`crate::uart_console::print!()`来调用它。
    
    故，我们应该使用`use crate::print`导入或直接通过`crate::print!()`进行调用。

--------

### 调用宏并测试

我们不再以额外文件`include!`的方式添加到`main.rs`，而是将其作为模块导入。

我们删除上一节中`main.rs`的测试代码，然后修改成如下（最终完整的`main.rs`文件）

```rust
// 不使用标准库
#![no_std]
// 不使用预定义入口点
#![no_main]
#![feature(global_asm)]

mod panic;
mod uart_console;

global_asm!(include_str!("start.s"));

#[no_mangle] // 不修改函数名
pub extern "C" fn not_main() {
    print!("Hello!");
    println!("[0] Hello from Rust!");
}
```

并在`src/uart_console.rs`开头导入`fmt`和`ptr`库

```rust
use core::{fmt, ptr};
```

然后编译运行：

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/rui_armv8_os
```

![输出宏实现](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/6.png)

--------

## 实验三（施工中...）
