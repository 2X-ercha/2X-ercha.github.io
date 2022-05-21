---
title: rust写个操作系统——课程实验blogos移至armV8深度解析：实验六 GPIO关机
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: ec262d5c
date: 2022-04-26 20:01:00
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

## 实验六 GPIO关机

我们不能一直到qemu的暴力退出来关机（就是不用系统的关机而暴力断电）。所幸，virt机器为我们提供了GPIO来实现关机功能。这节我们将编写GPIO相关的驱动来实现关机功能。

--------

### 实验目的

实验指导书中这节也没有写实验目的。我大致把目的划分如下：

1. 编写pl061（GPIO）通用输入输出模块的驱动

2. 实现关机功能

--------

### pl061（GPIO）模块驱动编写

上一实验我们已经对`tock-registers`有了基础的了解，恰好实验六终于是有点意思，开始让我们自己写驱动了。

所以在这节我们将做一个示例，讲述我们该如何去描述一个硬件的驱动。

#### pl061（GPIO）基本知识

GPIO`（General-purpose input/output）`，通用型之输入输出的简称，功能类似8051的`P0—P3`，其接脚可以供使用者由程控自由使用，PIN脚依现实考量可作为通用输入（GPI）或通用输出（GPO）或通用输入与输出（GPIO），如当`clk generator`, `chip select`等。

既然一个引脚可以用于输入、输出或其他特殊功能，那么一定有寄存器用来选择这些功能。对于输入，一定可以通过读取某个寄存器来确定引脚电位的高低；对于输出，一定可以通过写入某个寄存器来让这个引脚输出高电位或者低电位；对于其他特殊功能，则有另外的寄存器来控制它们。

而在此实验中，我们用的`arm`架构的GPIO文档在此：[ARM PrimeCell General Purpose Input/Output (PL061) Technical Reference Manual](https://developer.arm.com/documentation/ddi0190/b)

#### virt机器关机原理

查看设备树：

```vts
gpio-keys {
        #address-cells = <0x01>;
        #size-cells = <0x00>;
        compatible = "gpio-keys";

        poweroff {
                gpios = <0x8003 0x03 0x00>;
                linux,code = <0x74>;
                label = "GPIO Key Poweroff";
        };
};
```

![virt机器关机原理](https://os2022exps-doc.readthedocs.io/zh_CN/latest/_images/gpio-poweroff.png)

可以看到，关机键接入到了GPIO处理芯片的三号输入口（设备树上的反映在`gpio-keys`的`poweroff["gpios"]`第二个参数反映。当外部输入关机指令时，三号线将产生一次信号并发生一次中断。让我们记住这一点，这是实现关机功能的关键。

#### 驱动编写实例

由于我们只需要实现关机功能，所以这里我们也并不定义额外的寄存器。之所以我在这里称之为一个示例，是因为我们并没有完整的实现它。

当我们向`GPIO`中输入关机指令时，`GPIORIS`（中断状态寄存器`PrimeCell GPIO raw interrupt status`）中的第三位将从`0`跳变到`1`。而当`GPIOIE`（中断掩码寄存器`PrimeCell GPIO interrupt mask`）中的第三位为`1`时，GPIO处理芯片将向GIC中断控制器发送一次中断，中断号为`39`。而我们受到中断后，需要丢此次GPIO中断进行清除，将`GPIOIC`（中断清除寄存器`PrimeCell GPIO interrupt clear`）的对应位置为`1`，然后进行关机操作。

另外在设备树文件中，关于GPIO的设备描述如下：

```vts
pl061@9030000 {
        phandle = <0x8003>;
        clock-names = "apb_pclk";
        clocks = <0x8000>;
        interrupts = <0x00 0x07 0x04>;
        gpio-controller;
        #gpio-cells = <0x02>;
        compatible = "arm,pl061\0arm,primecell";
        reg = <0x00 0x9030000 0x00 0x1000>;
};
```

可以看到GPIO设备的内存映射起始地址是`0x09030000`。

由于`GPIORIS`是一个只读寄存器，而我们知道一旦关机该寄存器的值将变为`0b00001000`（三号线产生的中断），在此我们并不需要将其在代码中体现。因此，我们在本节实验中，只需要定义`GPIOIE`和`GPIOIC`两个寄存器。

现在我们开始动手写驱动了，新建`src/pl061.rs`，先写入一个基本的模板。

```rust
use tock_registers::{registers::{ReadWrite, WriteOnly, ReadOnly}, register_bitfields, register_structs};

// 寄存器基址定义
pub const PL061REGS: *mut PL061Regs = (0x0903_0000) as *mut PL061Regs;

// 寄存器位级描述
register_bitfields! [
    u32,
];

// 寄存器结构定义和映射描述
register_structs! {
    pub PL061Regs {
    }
}
```

我们自顶向下，从**寄存器结构定义和映射**开始，在到**寄存器位级细节**进行对应的定义：

##### 寄存器基本结构描述

首先是两个寄存器的定义，我们查看GPIO的寄存器表：[Summary of PrimeCell GPIO registers](https://developer.arm.com/documentation/ddi0190/b/programmer-s-model/summary-of-primecell-gpio-registers)，找到我们需要的两个寄存器信息：

![GPIOIE](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/GPIOIE.png)

![GPIOIC](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/GPIOIC.png)

需要记下的是两个寄存器的基址和读写类型，我们可以作如下基本的定义：

```rust
// 寄存器结构定义和映射描述
register_structs! {
    pub PL061Regs {
        (0x410 => pub ie: ReadWrite<u32>),
        (0x41c => pub ic: WriteOnly<u32>),
    }
}
```

而`tock-registers`对寄存器结构定义有如下的要求，我用加粗标识出我们需要注意的部分：

> 寄存器的定义是通过`register_structs`宏完成的，该宏要求每个寄存器有一个偏移量、一个字段名和一个类型。寄存器必须按**偏移量的递增顺序**和**连续顺序**声明。定义寄存器时，必须使用偏移量和**间隙标识符（按照惯例，使用名为_reservedN的字段）显式注释间隙**，但不使用类型。然后，宏将自动计算间隙大小并插入合适的填充结构。结构的**末尾用大小和@end关键字标记**，有效地指向寄存器列表后面的偏移量。

寄存器基址从`0x000`开始，故我们填入空缺，并在最后一个寄存器的下一个地址填入`@end`标记：

```rust
// 寄存器结构定义和映射描述
register_structs! {
    pub PL061Regs {
        (0x000 => __reserved_0),
        (0x410 => pub ie: ReadWrite<u32>),
        (0x414 => __reserved_1),
        (0x41c => pub ic: WriteOnly<u32>),
        (0x420 => @END),
    }
}
```

##### 寄存器位级细节

首先是`GPIOIE`寄存器的细节定义，我们查看该寄存器的细节：[Interrupt mask register, GPIOIE](https://developer.arm.com/documentation/ddi0190/b/programmer-s-model/register-descriptions/interrupt-mask-register--gpioie)

可以知道每位的值即为对应输入输出线的中断掩码。例如第3号位（0开始）的中断启用，则应设置第三位的值为`1`。我们在`register_bitfields!`宏中写入我们需要的第三号位具体描述：

```rust
// 寄存器位级描述
register_bitfields![
    u32,

    // PrimeCell GPIO interrupt mask
    pub GPIOIE [
        IO3 OFFSET(3) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ]
    ],
];
```

> 这里的`IO3`只是对三号位的一个命名，`OFFSET`偏移参数指明该位为第三号位，`NUMBITS`指明该位功能共有1位。你在其它的定义中可能会见到以两位甚至更多来存储对应信息。
>
> `IO3`下的键值更像是一种标识，定义后变可以以更方便的方式对寄存器进行读写。左边的命名是对右边赋值的解释。我们之后在解释时，不需要去记忆某一个位中赋值多少是什么功能，而可以通过命名去做精准的调用。例如[官方文档示例](https://github.com/tock/tock/blob/master/libraries/tock-register-interface/README.md)中：
>
> ```rust
> Control [
> RANGE OFFSET(4) NUMBITS(2) [
>     // Each of these defines a name for a value that the bitfield can be
>     // written with or matched against. Note that this set is not exclusive--
>     // the field can still be written with arbitrary constants.
>     VeryHigh = 0,
>     High = 1,
>     Low = 2
> ]]
> ```
>
> 我们在对`Control`寄存器的[4:6]号位赋值低电平时，只需要使用`xx::Control.write(xx::Control::Low)`，而无需记忆低电平是`0`还是`2`

然后我们需要将寄存器结构描述中的寄存器与其细节联系起来，修改`register_structs!`宏中的`0X410`一行：

```diff
-         (0x410 => pub ie: ReadWrite<u32>),
+         (0x410 => pub ie: ReadWrite<u32, GPIOIE::Register>),
```

发生中断时，回调处理中`GPIOIC`寄存器的值我们可以直接写入`GPIOIE`来描述，这里对不对其进行细节描述并不重要。当然对其具体定义也不会有太大的问题。

而在模板开头我们引入了类型`READONLY`，而我们定义完寄存器后并没有使用它，因此删除这个引用。

```diff
- use tock_registers::{registers::{ReadWrite, WriteOnly, ReadOnly}, register_bitfields, register_structs};
+ use tock_registers::{registers::{ReadWrite, WriteOnly}, register_bitfields, register_structs};
```

最后记得向`src/main.rs`中引入驱动：`mod pl061;`，最终的`pl061`模块驱动如下：

```rust
use tock_registers::{registers::{ReadWrite, WriteOnly}, register_bitfields, register_structs};

// 寄存器结构定义和映射描述
pub const PL061REGS: *mut PL061Regs = (0x0903_0000) as *mut PL061Regs;

// 寄存器位级描述
register_bitfields![
    u32,

    // PrimeCell GPIO interrupt mask
    pub GPIOIE [
        IO3 OFFSET(3) NUMBITS(1) [
            Disabled = 0,
            Enabled = 1
        ]
    ],
];

// 寄存器结构定义和映射描述
register_structs! {
    pub PL061Regs {
        (0x000 => __reserved_0),
        (0x410 => pub ie: ReadWrite<u32, GPIOIE::Register>),
        (0x414 => __reserved_1),
        (0x41c => pub ic: WriteOnly<u32>),
        (0x420 => @END),
    }
}
```

个人也写了个较为完整的驱动（gpiodata那个描述可能有些问题），可以查看[https://github.com/2X-ercha/blogOS-armV8/blob/lab6/src/pl061_all.rs](https://github.com/2X-ercha/blogOS-armV8/blob/lab6/src/pl061_all.rs)

### 实现关机中断及其处理回调函数

关机中断仍然是`el1_irq`级别的中断，经过了上两个实验的回调函数编写，这部分可以说是熟门熟路了。

#### 关机中断初始化

同前两个中断一样，我们还是需要对输入中断进行启用和配置。同时不一样的是，我们还要为`GPIO`的`GPIOIE`中断掩码寄存器作初始化。修改`src/interrupts.rs`，新增如下内容：

```rust
// GPIO中断号39
const GPIO_IRQ: u32 = 39;

use tock_registers::interfaces::{Readable, Writeable};

pub fn init_gicv2() {
    // ...

    // 初始化GPIO中断
    set_config(GPIO_IRQ, ICFGR_LEVEL); //电平触发
    set_priority(GPIO_IRQ, 0); //优先级设定
    clear(GPIO_IRQ); //清除中断请求
    enable(GPIO_IRQ); //使能中断

    // 使能GPIO的poweroff key中断
    use crate::pl061::*;
    unsafe{
        let pl061r: &PL061Regs = &*PL061REGS;

        // 启用pl061 gpio中的3号线中断
        pl061r.ie.write(GPIOIE::IO3::Enabled);
    }
}
```

#### 关机中断处理回调

然后对关机中断进行处理：修改我们的中断实际处理函数`handle_irq_lines`为如下，并新增输入中断处理函数`handle_gpio_irq`：

```rust
fn handle_irq_lines(ctx: &mut ExceptionCtx, _core_num: u32, irq_num: u32) {
    if irq_num == TIMER_IRQ {
        handle_timer_irq(ctx);
    } else if irq_num == UART0_IRQ {
        handle_uart0_rx_irq(ctx);
    } else if irq_num == GPIO_IRQ {
        handle_gpio_irq(ctx);
    } else{
        catch(ctx, EL1_IRQ);
    }
}

fn handle_gpio_irq(_ctx: &mut ExceptionCtx){
    use crate::pl061::*;
    crate::println!("power off!\n");
    unsafe {
        let pl061r: &PL061Regs = &*PL061REGS;

        // 清除中断信号 此时get到的应该是0x8
        pl061r.ic.set(pl061r.ie.get());
        // 关机
        asm!("mov w0, #0x18");
        asm!("hlt #0xF000");
    }
}
```

我们尝试关机，这里用到了`Arm`的`Semihosting`功能。

> Semihosting 的作用
>
> Semihosting 能够让 bare-metal 的 ARM 设备通过拦截指定的 SVC 指令，在连操作系统都没有的环境中实现 POSIX 中的许多标准函数，比如 printf、scanf、open、read、write 等等。这些 IO 操作将被 Semihosting 协议转发到 Host 主机上，然后由主机代为执行。

构建并运行内核。为了启用`semihosting`功能，在QEMU执行时需要加入`-semihosting`参数

```bash
cargo build
qemu-system-aarch64 -machine virt -m 1024M -cpu cortex-a53 -nographic -kernel target/aarch64-unknown-none-softfloat/debug/blogos_armv8 -semihosting
```

在系统执行过程中，在窗口按键`ctrl + a, c`，后输入`system_powerdown`关机。（这里为了实验更加直观，我注释掉了时间中断的打点输出）

![关机！](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/blogos-armv8/powerdown.png)
