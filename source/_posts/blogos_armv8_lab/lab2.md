---
title: rust写个操作系统——课程实验blogos移至armV8深度解析：实验二 Hello World
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: 4735f31b
date: 2022-04-19 20:01:00
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

## 实验二 Hello World

上一个实验里，我们已经初步实现了让内核运行一开始输出`"Hello World"`，也初步了解到程序是如何调用硬件设备的寄存器。然而我们希望能在实验的每一个rust代码文件中，都能方便的调用`print`，而不是每一次输出都需要写一大串代码。

用函数模块化固然是个不错的方法，但当我们想调用它时就需要向`c`语言那样调用`stdio.h`头文件。这时候我们就需要了解`rust`本身的一个高级特性：宏

所以实验二我们将实现`rust`中最经典的宏：`print!`和`println!`，以便于后续的调试输出。

注：至于实验指导书中关于`virt`机器和设备树的部分，我会将其放到选做的实验三。实验三选做但是必要，是理解后续实验的关键。另外吐槽的是这节的实验指导书意外的还不错，我可以偷懒一点。

--------

### 实验目的

实验二的开头是这么说的：

> 本实验的目的在于理解操作系统与硬件的接口方法，并实现一个可打印字符的宏（非系统调用），用于后续的调试和开发。

其实我们在`not_main`函数中就已经完成的对串口作了硬件上的调用，而更具体的调用则需要阅读设备树源文件和设备寄存器接口文档。这将在实验三实验四会有更实际的体现。所以实验目的我认为是如下几点（第一点其实也不太重要）：

1. 初步了解rust宏（rust语言特性，可略过）

2. 将实验一的输出封装成实例以便调用

3. 将实例封装成宏，实现`print!`和`println!`

--------

### rust 宏（选看）

#### 什么是宏？

熟悉C/C++的应该很熟悉宏（`Macro`）的概念，而Rust初学者也必定会接触到Rust中的宏。

可以简单地理解为：宏即编译时将执行的一系列指令。其重点在于「编译时」，尽管宏与函数（或方法）形似，函数是在运行时发生调用的，而宏是在编译时执行的。

不同于C/C++中的宏，Rust的宏并非简单的文本替换，而是在词法层面甚至语法树层面作替换，其功能更加强大，也更加安全。

如下所示的一个C++的宏SQR的定义

```c
#include <iostream>
#define SQR(x) (x * x)
int main() {
    std::cout << SQR(1 + 1) << std::endl;
    return 0;
}
```

我们希望它输出4，但很遗憾它将输出3，因为`SQR(1 + 1)`在预编译阶段通过文本替换展开将得到`(1 + 1 * 1 + 1)`（替换时没给你加括号），并非我们所期望的语义。

而在Rust中，按如下方式定义的宏：

```rust
macro_rules! sqr {
    ($x:expr) => {$x * $x}
}

fn main() {
    println!("{}", sqr!(1 + 1));
}
```

将得到正确的答案4。这是因为Rust的宏展开发生在语法分析阶段，此时编译器知道sqr!宏中的$x变量是一个表达式（用$x:expr标记），所以在展开后它知道如何正确处理，会将其展开为`((1 + 1) * (1 + 1))`。

--------

#### 宏和函数的区别

从根本上来说，宏是一种为写其他代码而写代码的方式，即所谓的**元编程（metaprogramming）**。所有的这些宏以**展开**的方式来生成比你所手写出的更多的代码。

元编程对于减少大量编写和维护的代码是非常有用的，它也扮演了函数扮演的角色。但宏有一些函数所没有的附加能力。

一个函数标签必须声明函数参数个数和类型。相比之下，宏能够接受不同数量的参数：用一个参数调用`println!("hello")`或用两个参数调用`println!("hello {}", name)`。而且，宏可以在编译器翻译代码前展开，例如，宏可以在一个给定类型上实现`trait`。而函数则不行，因为函数是在运行时被调用，同时`trait`需要在编译时实现。

实现一个宏而不是一个函数的缺点是宏定义要比函数定义更复杂，因为你正在编写**生成 Rust 代码的 Rust 代码**。由于这样的间接性，宏定义通常要比函数定义更难阅读、理解以及维护。

宏和函数的最后一个重要的区别是：在一个文件里调用宏之前必须定义它，或将其引入作用域，而函数则可以在任何地方定义和调用。

--------

#### 宏的分类

宏可以分为：使用 macro_rules! 的 声明（Declarative）宏，和三种 过程（Procedural）宏：

* 自定义 #[derive] 宏在结构体和枚举上指定通过 derive 属性添加的代码

* 类属性（Attribute-like）宏定义可用于任意项的自定义属性

* 类函数宏看起来像函数不过作用于作为参数传递的 token

这里我们只了解声明宏。我们的`print!`和`println!`宏都是声明宏。

--------

#### 声明宏

Rust 最常用的宏形式是 声明宏（declarative macros）。它们有时也被称为 “macros by example”、“macro_rules! 宏” 或者就是 “macros”。其核心概念是，声明宏允许我们编写一些类似 Rust match 表达式的代码。match 表达式是控制结构，其接收一个表达式，与表达式的结果进行模式匹配，然后根据模式匹配执行相关代码。宏也将一个值和包含相关代码的模式进行比较；此种情况下，该值是传递给宏的 Rust 源代码字面值，模式用于和传递给宏的源代码进行比较，同时每个模式的相关代码则用于替换传递给宏的代码。所有这一切都发生于编译时。

可以使用 macro_rules! 来定义宏，如：

```rust
#[macro_export]
macro_rules! vec {
    ( $( $x:expr ),* ) => {
        {
            let mut temp_vec = Vec::new();
            $(
                temp_vec.push($x);
            )*
            temp_vec
        }
    };
}
```

无论何时导入定义了宏的包，`#[macro_export]`注解说明宏应该是可用的。 如果没有该注解，这个宏不能被引入作用域。

接着使用 `macro_rules!` 和宏名称开始宏定义，且所定义的宏并不带感叹号。名字后跟大括号表示宏定义体，在该例中宏名称是 `vec` 。

首先，一对括号包含了整个模式。接下来是美元符号（`$`），后跟一对括号，捕获了符合括号内模式的值以用于替换后的代码。`$()`内则是`$x:expr`，其匹配Rust的任意表达式，并将该表达式记作`$x`。

`$()`之后的逗号说明一个可有可无的逗号分隔符可以出现在`$()`所匹配的代码之后。紧随逗号之后的`*`说明该模式匹配零个或更多个`*`之前的任何模式。

当以`vec![1, 2, 3];`调用宏时，`$x`模式与三个表达式 1、2 和 3 进行了三次匹配。

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
