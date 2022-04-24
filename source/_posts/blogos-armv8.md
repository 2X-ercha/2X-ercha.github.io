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
updated: 2022-04-24 15:27:00
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

### Write 实例实现和测试

#### 实例实现

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

#### 测试

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

### print!和println!封装

现在我们已经可以采用print_something函数通过串口输出字符了。但为了输出，我们需要两个步骤：

（1）创建Writer类型的实例

（2）调用实例的write_byte或write_string等函数。

为了方便在其他模块中调用，我们希望可以直接执行步骤（2）而不是首先执行上述步骤（1）再执行步骤（2）。

一般情况下可以通过将步骤（1）中的实例定义为static类型来实现

--------

#### Write全局接口

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

#### 实现 print! 宏

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

#### 调用宏并测试

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

--------

## 实验四：中断

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

*   ```vts
    reg = <0x00 0x8000000 0x00 0x10000 0x00 0x8010000 0x00 0x10000>;
    ```

    约定：GICD寄存器映射到内存的位置为0x8000000，长度为0x10000， GICC寄存器映射到内存的位置为0x8010000，长度为0x10000

*   ```vts
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

在这里我们将这个函数设置成为了低电平触发，所以我们在主函数调用时需要将系统转入低电平的运行状态。编辑`src/main.rs`，结果如下：

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
    unsafe {
        loop { // 轮询系统中断
            asm!("wfi"); // 将系统置于低电平运行状态
        }
    }
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

--------

## 实验五 输入

### 时钟中断回调函数实现

在上一个实验中，我们实现了时间中断，但没有对引发的时间中断做处理回调。我们先扫尾，然后再来处理输入中断。

我们知道，时间中断后引发的异常是`el1_irq`类中断，所以我们所需修改的是`src/interrupts.rs`文件中关于`el1_irq`的回调函数。原函数如下：

```rust
#[no_mangle]
unsafe extern "C" fn el1_irq(ctx: &mut ExceptionCtx) {
    catch(ctx, EL1_IRQ);
}
```

我们需要的是实现对时钟的中断进行准确的分辨，所以我们需要在该异常被处发后，读取中断号并作相应处理。

当定时器触发时间中断后，中断控制器的`GICC_IAR`寄存器将被写入中断号`30`。结合上节的GICC寄存器表，我们在GICC寄存器处新增两个需要调用的寄存器地址映射，定义如下：

```diff
  //GICC寄存器基址
  const GICD_BASE: u64 = 0x08010000;

  //GICC实验所需寄存器
  const GICC_CTLR: *mut u32 = (GICC_BASE + 0x0) as *mut u32;
  const GICC_PMR: *mut u32 = (GICC_BASE + 0x0004) as *mut u32;
  const GICC_BPR: *mut u32 = (GICC_BASE + 0x0008) as *mut u32;
+ const GICC_IAR: *mut u32 = (GICC_BASE + 0x0c) as *mut u32;
+ const GICC_EOIR: *mut u32 = (GICC_BASE + 0x10) as *mut u32;
```

* `GICC_IAR`寄存器中存放的是当前的中断号。例如当时间中断发生时，寄存器中将写入中断号`30`（前5位）和对应的内核编号（后三位），我们可以通过读取该寄存器中的值来做中断号识别

* `GICC_EOIR`寄存器则用于标记某一中断被完成，即中断处理结束的信号。这个信号告诉控制器：中断已经被处理，并且系统已经准备好接收下一个中断。 

基于以上，我们可以根据[GIC手册](https://documentation-service.arm.com/static/5f8ff196f86e16515cdbf969?token=)修改`el1_irq`处理回调函数，修改如下：

```rust
#[no_mangle]
unsafe extern "C" fn el1_irq(ctx: &mut ExceptionCtx) {
    // 中断确认（读取中断号和中断对应核）
    let value: u32 = ptr::read_volatile(GICC_IAR);
    let irq_num: u32 = value & 0x1ff;
    let core_num: u32 = value & 0xe00;

    // 实际处理中断
    handle_irq_lines(ctx, core_num, irq_num);

    // 中断完成标记信号
    ptr::write_volatile(GICC_EOIR, core_num | irq_num);

    // 清除相应中断位
    clear(irq_num);
}
```

并编写中断处理函数`handle_irq_lines`：

```rust
fn handle_irq_lines(ctx: &mut ExceptionCtx, _core_num: u32, irq_num: u32) {
    if irq_num == TIMER_IRQ {       // 确认时间中断
        handle_timer_irq(ctx);
    } else{
        catch(ctx, EL1_IRQ);
    }
}

// 时间中断对应处理函数
fn handle_timer_irq(_ctx: &mut ExceptionCtx){

    crate::print!(".");     //我们令其每发生一次中断就打点一次，更直观的体现出发生时间中断

    // 重置定时器，使其再过2秒产生一次中断
    unsafe {
        asm!("mrs x1, CNTFRQ_EL0");
        asm!("add x1, x1, x1");
        asm!("msr CNTP_TVAL_EL0, x1");
    }
}
```

大致的流程还是很好理解的，我们编译运行后看看效果：

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

效果如下（每两秒将会有一次打点）：

![2s打点](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/timer2s.png)

循环打点一方面是定时的功劳，另一方面是主函数中循环将系统置于低电平状态后的结果。每一次的中断处理后，系统将重新回到高电平运行状态。如果我们不采用`loop`轮询，将只会发生一次打点，此后及时重新到达定时器时间并发送了时钟中断，GIC也不会进行处理（因为设置的是低电平触发）。

### pl011（UART）异步串行接口驱动编写

QEMU的virt机器默认没有键盘作为输入设备，但当我们执行QEMU使用`-nographic`参数（disable graphical output and redirect serial I/Os to console）时QEMU会将串口重定向到控制台，因此我们可以使用UART作为输入设备。

通用异步收发传输器（Universal Asynchronous Receiver/Transmitter)，通常称作UART。它将要传输的资料在串行通信与并行通信之间加以转换。作为把并行输入信号转成串行输出信号的芯片，UART通常被集成于其他通讯接口的连结上。

UART作为异步串口通信协议的一种，工作原理是将传输数据的每个字符一位接一位地传输。我们在控制台中的输入，也会被它传输到qemu中。

#### tock-registers

在实验四中，针对GICD，GICC，TIMER等硬件我们定义了大量的常量和寄存器值，这在使用时过于繁琐也容易出错。于是我们决定使用`tock-registers`库。

`tock-registers`提供了一些接口用于更好的定义寄存器。官方说明如下：

> The crate provides three types for working with memory mapped registers: `ReadWrite`, `ReadOnly`, and `WriteOnly`, providing read-write, read-only, and write-only functionality, respectively. These types implement the `Readable`, `Writeable` and `ReadWriteable`  traits.
> 
> Defining the registers is done with the `register_structs` macro, which expects for each register an offset, a field name, and a type. Registers must be declared in increasing order of offsets and contiguously. Gaps when defining the registers must be explicitly annotated with an offset and gap identifier (by convention using a field named `_reservedN`), but without a type. The macro will then automatically take care of calculating the gap size and inserting a suitable filler struct. The end of the struct is marked with its size and the `@END` keyword, effectively pointing to the offset immediately past the list of registers.

翻译如下：

> tock-registers 提供了三种类型的内存映射寄存器：ReadWrite、ReadOnly和WriteOnly，分别提供读写、只读和只读功能。这些类型实现了可读、可写和可读写特性。
> 
> 寄存器的定义是通过`register_structs`宏完成的，该宏要求每个寄存器有一个偏移量、一个字段名和一个类型。寄存器必须按偏移量的递增顺序和连续顺序声明。定义寄存器时，必须使用偏移量和间隙标识符（按照惯例，使用名为_reservedN的字段）显式注释间隙，但不使用类型。然后，宏将自动计算间隙大小并插入合适的填充结构。结构的末尾用大小和@end关键字标记，有效地指向寄存器列表后面的偏移量。

根据官方的说明[tock_registers](https://docs.rs/tock-registers/latest/tock_registers/)作为一个示例，我们来实现`pl011`串口驱动。

阅读设备树关于`pl011`部分内容（实验二）：

```dts
pl011@9000000 {
    clock-names = "uartclk\0apb_pclk";
    clocks = <0x8000 0x8000>;
    interrupts = <0x00 0x01 0x04>;
    reg = <0x00 0x9000000 0x00 0x1000>;
    compatible = "arm,pl011\0arm,primecell";
};

chosen {
    stdout-path = "/pl011@9000000";
    kaslr-seed = <0xcbd0568d 0xb463306c>;
};
```

由上可以看出，virt机器包含有pl011的设备，该设备的寄存器在`0x9000000`开始处。pl011实际上是一个UART设备，即串口。可以看到virt选择使用pl011作为标准输出，这是因为与PC不同，大部分嵌入式系统默认情况下并不包含VGA设备。

而[uart寄存器表](https://developer.arm.com/documentation/ddi0183/g/programmers-model/summary-of-registers?lang=en)也列出了UART相关的寄存器如下图所示：

![uart](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/uart.png)

我们可以开始定义`pl011`驱动文件了。原则上来讲这部分内容应当定义在`src/uart_console.rs`中。但为了避免代码过长，我们选择重构`uart_console.rs`。

首先创建`src/uart_console`目录，并将原`uart_console.rs`更名为`mod.rs`，且置于`src/uart_console`目录下， 最后新建`src/uart_console/pl011.rs`文件。目录结构看起来像这样：

```
.
|____Cargo.toml
|____Cargo.lock
|____.cargo
| |____config.toml
|____aarch64-qemu.ld
|____.vscode
| |____launch.json
|____aarch64-unknown-none-softfloat.json
|____src
| |____panic.rs
| |____start.s
| |____interrupts.rs
| |____main.rs
| |____uart_console
| | |____mod.rs
| | |____pl011.rs
| |____exception.s
```

我们先需要在`Cargo.toml`中的`[dependencies]`节中加入依赖（这里实验指导书有误）：

```toml
[dependencies]
tock-registers = "0.7.0"
```

#### 驱动编写

根据上述`tock_registers`官方说明和寄存器表，我们修改`src/uart_console/pl011.rs`如下：

```rust
use tock_registers::{registers::{ReadOnly, ReadWrite, WriteOnly}, register_bitfields, register_structs};

pub const PL011REGS: *mut PL011Regs = (0x0900_0000) as *mut PL011Regs;

register_bitfields![
    u32,

    pub UARTDR [
        DATA OFFSET(0) NUMBITS(8) []
    ],
    /// Flag Register
    pub UARTFR [
        /// Transmit FIFO full. The meaning of this bit depends on the
        /// state of the FEN bit in the UARTLCR_ LCRH Register. If the
        /// FIFO is disabled, this bit is set when the transmit
        /// holding register is full. If the FIFO is enabled, the TXFF
        /// bit is set when the transmit FIFO is full.
        TXFF OFFSET(6) NUMBITS(1) [],

        /// Receive FIFO empty. The meaning of this bit depends on the
        /// state of the FEN bit in the UARTLCR_H Register. If the
        /// FIFO is disabled, this bit is set when the receive holding
        /// register is empty. If the FIFO is enabled, the RXFE bit is
        /// set when the receive FIFO is empty.
        RXFE OFFSET(4) NUMBITS(1) []
    ],

    /// Integer Baud rate divisor
    pub UARTIBRD [
        /// Integer Baud rate divisor
        IBRD OFFSET(0) NUMBITS(16) []
    ],

    /// Fractional Baud rate divisor
    pub UARTFBRD [
        /// Fractional Baud rate divisor
        FBRD OFFSET(0) NUMBITS(6) []
    ],

    /// Line Control register
    pub UARTLCR_H [
        /// Parity enable. If this bit is set to 1, parity checking and generation
        /// is enabled, else parity is disabled and no parity bit added to the data frame.
        PEN OFFSET(1) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ],
        /// Two stop bits select. If this bit is set to 1, two stop bits are transmitted
        /// at the end of the frame.
        STP2 OFFSET(3) NUMBITS(1) [
            Stop1 = 0,
            Stop2 = 1
        ],
        /// Enable FIFOs.
        FEN OFFSET(4) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ],

        /// Word length. These bits indicate the number of data bits
        /// transmitted or received in a frame.
        WLEN OFFSET(5) NUMBITS(2) [
            FiveBit = 0b00,
            SixBit = 0b01,
            SevenBit = 0b10,
            EightBit = 0b11
        ]
    ],

    /// Control Register
    pub UARTCR [
        /// Receive enable. If this bit is set to 1, the receive
        /// section of the UART is enabled. Data reception occurs for
        /// UART signals. When the UART is disabled in the middle of
        /// reception, it completes the current character before
        /// stopping.
        RXE    OFFSET(9) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ],

        /// Transmit enable. If this bit is set to 1, the transmit
        /// section of the UART is enabled. Data transmission occurs
        /// for UART signals. When the UART is disabled in the middle
        /// of transmission, it completes the current character before
        /// stopping.
        TXE    OFFSET(8) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ],

        /// UART enable
        UARTEN OFFSET(0) NUMBITS(1) [
            /// If the UART is disabled in the middle of transmission
            /// or reception, it completes the current character
            /// before stopping.
            Disabled = 0,
            Enabled = 1
        ]
    ],

    pub UARTIMSC [
        RXIM OFFSET(4) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ]
    ],
    /// Interupt Clear Register
    pub UARTICR [
        /// Meta field for all pending interrupts
        ALL OFFSET(0) NUMBITS(11) [
            Clear = 0x7ff
        ]
    ]
];
```

这里对以上读写内容也不再细讲。只需要知道的是`pl011`的设备基址位于`0x0900_0000`(第二行代码），然后根据寄存器表定义我们需要的寄存器：

```rust
register_structs! {
    pub PL011Regs {
        (0x00 => pub dr: ReadWrite<u32, UARTDR::Register>),                   // 0x00
        (0x04 => __reserved_0),               // 0x04
        (0x18 => pub fr: ReadOnly<u32, UARTFR::Register>),      // 0x18
        (0x1c => __reserved_1),               // 0x1c
        (0x24 => pub ibrd: WriteOnly<u32, UARTIBRD::Register>), // 0x24
        (0x28 => pub fbrd: WriteOnly<u32, UARTFBRD::Register>), // 0x28
        (0x2C => pub lcr_h: WriteOnly<u32, UARTLCR_H::Register>), // 0x2C
        (0x30 => pub cr: WriteOnly<u32, UARTCR::Register>),     // 0x30
        (0x34 => __reserved_2),               // 0x34
        (0x38 => pub imsc: ReadWrite<u32, UARTIMSC::Register>), // 0x38
        (0x44 => pub icr: WriteOnly<u32, UARTICR::Register>),   // 0x44
        (0x48 => @END),
    }
}
```

这看起来好像比实验四中对应的寄存器描述部分要复杂，但如果你熟悉了之后，基本上可以依据技术参考手册中的寄存器描述无脑写了。（很多部分可以无脑抄）

然后我们在`src/uart_console/mod.rs`中引入`pl011.rs`，并修改`write_byte`。

我们在前面对输出是直接定义寄存器常量的

```rust
pub fn write_byte(&mut self, byte: u8) {
        const UART0: *mut u8 = 0x0900_0000 as *mut u8;
        unsafe {
            ptr::write_volatile(UART0, byte);
        }
    }
```

而现在我们已经定义好了`UART`的寄存器表，可以选择直接调用`pl011.rs`中定义的寄存器：

```rust
use tock_registers::{interfaces::Writeable};

pub mod pl011;
use pl011::*;

pub fn write_byte(&mut self, byte: u8) {
    // const UART0: *mut u8 = 0x0900_0000 as *mut u8;
    unsafe {
        // pl011 device registers
        let pl011r: &PL011Regs = &*PL011REGS;
        // ptr::write_volatile(UART0, byte);
        pl011r.dr.write(UARTDR::DATA.val(byte as u32));
    }
}
```

由于我们较为完整的定义好了`pl011`寄存器组，每次调用都需要一次初始化行为。故我们还需要为`Writer`结构实现构造函数，并修改`WRITER`宏的定义：

```rust
//往串口寄存器写入字节和字符串进行输出
impl Writer {
    // ...

    pub fn new() -> Writer{

        unsafe {
            // pl011 device registers
            let pl011r: &PL011Regs = &*PL011REGS;

            // 禁用pl011
            pl011r.cr.write(UARTCR::TXE::Disabled + UARTCR::RXE::Disabled + UARTCR::UARTEN::Disabled);
            // 清空中断状态
            pl011r.icr.write(UARTICR::ALL::Clear);
            // 设定中断mask，需要使能的中断
            pl011r.imsc.write(UARTIMSC::RXIM::Enabled);
            // IBRD = UART_CLK / (16 * BAUD_RATE)
            // FBRD = ROUND((64 * MOD(UART_CLK,(16 * BAUD_RATE))) / (16 * BAUD_RATE))
            // UART_CLK = 24M
            // BAUD_RATE = 115200
            pl011r.ibrd.write(UARTIBRD::IBRD.val(13));
            pl011r.fbrd.write(UARTFBRD::FBRD.val(1));
            // 8N1 FIFO enable
            pl011r.lcr_h.write(UARTLCR_H::WLEN::EightBit + UARTLCR_H::PEN::Disabled + UARTLCR_H::STP2::Stop1
                + UARTLCR_H::FEN::Enabled);
            // enable pl011
            pl011r.cr.write(UARTCR::UARTEN::Enabled + UARTCR::RXE::Enabled + UARTCR::TXE::Enabled);
        }

        Writer
    }
}

lazy_static! {
    pub static ref WRITER: Mutex<Writer> = Mutex::new(Writer::new());
}
```

最后是将无用的`ptr`引用去除

```diff
- use core::{fmt, ptr};
+ use core::fmt;
```

至此，我们完成了所有关于pl011（uart）串口驱动的编写。

### 串口输入中断处理回调

第一节我们讲到了如何去实现timer中断的处理回调。而输入中断也是`el1_irq`一类的中断。回到我们修改/新增的几个函数，我们将中断实际处理部分针对输入中断做一些判断和处理即可。

#### 输入中断初始化

同时钟中断一样，我们还是需要对输入中断进行启用和配置。修改`src/interrupts.rs`，新增如下内容：

```rust
// 串口输入中断号33
const UART0_IRQ: u32 = 33;

pub fn init_gicv2() {
    // ...

    // 初始化UART0 中断
    // interrupts = <0x00 0x01 0x04>; SPI, 0x01, level
    set_config(UART0_IRQ, ICFGR_LEVEL); //电平触发
    set_priority(UART0_IRQ, 0); //优先级设定
    clear(UART0_IRQ); //清除中断请求
    enable(UART0_IRQ); //使能中断
}
```

#### 输入中断处理回调

然后对UART的数据接收中断进行处理：修改我们的中断实际处理函数`handle_irq_lines`为如下，并新增输入中断处理函数`handle_uart0_rx_irq`：

```rust
fn handle_irq_lines(ctx: &mut ExceptionCtx, _core_num: u32, irq_num: u32) {
    if irq_num == TIMER_IRQ {
        handle_timer_irq(ctx);
    } else if irq_num == UART0_IRQ {
        handle_uart0_rx_irq(ctx);
    } else{
        catch(ctx, EL1_IRQ);
    }
}

use tock_registers::interfaces::Readable;

fn handle_uart0_rx_irq(_ctx: &mut ExceptionCtx){
    use crate::uart_console::pl011::*;
    unsafe{
        // pl011 device registers
        let pl011r: &PL011Regs = &*PL011REGS;

        let mut flag = pl011r.fr.read(UARTFR::RXFE);
        while flag != 1 {
            let value = pl011r.dr.read(UARTDR::DATA);

            crate::print!("{}", value as u8 as char);
            flag = pl011r.fr.read(UARTFR::RXFE);
        }
    }
}
```

当我们输入一个字符后，uart产生一次输入中断，而输入中断处理函数则将我们输入的字符从寄存器中取出并调用`print!`宏打印出来。

由此我们完成了输入中断的处理。我们进行代码的构建并运行：

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8
```

当我们随意的在控制台中敲击字符，除去时钟中断的打点输出，我们将看到我们输入的字符。此时说明我们的输入中断是成功运作的。

![输入中断完成](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/uartOK.png)

## 实验六（施工中...)