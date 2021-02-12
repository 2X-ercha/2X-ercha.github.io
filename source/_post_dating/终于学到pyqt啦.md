---
title: 貌似我可以学习怎么用python做界面交互啦（1）——pyqtgrapy
date: 2020-12-07 21:18:03
updated: 2020-12-07 21:18:03
categories: 
- Code
- Python
tags: 
- Python
top_img: /img/pagecode.jpg
cover: /img/covercode.jpg
description: 学习新的知识（pyqtgrapht好难的样子啊）
---
#  PyQtGraph

PyQtGraph是Python的一个图形和用户界面库，主要用于工程和科学领域中数据可视化和图片处理等方面，其中一个重要的功能是提供了非常快速的交互式图形用以数据（图形，视频等）的可视化。

--------

# 安装PyQtGraph

这个包貌似比较奇怪，我习惯性的在命令行里~~熟练地~~打入了pip

```dos
pip install pyqtgraph
```

然后——直接打脸，使用时直接一个错误信息砸我脸上……

```dos
Exception                                 Traceback (most recent call last)
<ipython-input-3-2e1dae50167b> in <module>
      1 get_ipython().run_line_magic('gui', 'qt')
      2 
----> 3 import pyqtgraph as pg
      4 import numpy as np
      5 x = np.random.normal(size=1000)

~/.local/lib/python3.8/site-packages/pyqtgraph/__init__.py in <module>
     11 ## 'Qt' is a local module; it is intended mainly to cover up the differences
     12 ## between PyQt4 and PySide.
---> 13 from .Qt import QtGui, mkQApp
     14 
     15 ## not really safe--If we accidentally create another QApplication, the process hangs (and it is very difficult to trace the cause)

~/.local/lib/python3.8/site-packages/pyqtgraph/Qt.py in <module>
     44 
     45 if QT_LIB is None:
---> 46     raise Exception("PyQtGraph requires one of PyQt4, PyQt5, PySide or PySide2; none of these packages could be imported.")
     47 
     48 

Exception: PyQtGraph requires one of PyQt4, PyQt5, PySide or PySide2; none of these packages could be imported.
```

啊这，我还是先好好听课，看看老师怎么讲的

哦，原来还要装另一个包，再次pip

```dos
pip install pyopengl
```

然后还是不行，好吧，不用conda的后果就是附属的包都没有装，我又得自己一个一个地装附属包（pip的默认国外站点下载速度感人，所以我用了国内的镜像站）

```dos
pip install PyQt5 -i https://pypi.douban.com/simple
```

总算可以了（泪目）

--------

# 基础功能

## 交互功能

PyqtGraph提供了强大的交互式图形功能，所有的交互式功能都可用鼠标控制。在不同的图形中，鼠标各个键的功能不一样。

### 2D图形

* 鼠标左键：与图形中的元素进行交互（选择或者移动对象等）。如果鼠标光标下没有可移动对象，则用左键拖动将平移图形
* 右键拖动：缩放图形。水平左右拖动来控制左右缩放比例。垂直向上/向下拖动控制上下缩放比例
* 右键单击：在大多数情况下，单击右键将显示一个功能菜单，其中包含多个选项，具体取决于鼠标光标下的对象
* 中间按钮（或滚轮）拖动：按住滚轮的同时拖动鼠标将平移图形（在左键不能平移图形时可用滚轮平移）
* 滚轮旋转：放大和缩小图形

### 功能菜单

一般情况下，右击鼠标在图形上会出现一个功能菜单。部分的选项包括：

* 在数据范围发生改变时可以启用或者禁用自动缩放
* 将多个视图的轴链接在一起
* 可以启用或者禁用每个轴的鼠标交互
* 设置坐标的起始和终止值

### 3D图形

* 左键拖动：围绕中心点旋转图形
* 中间按钮拖动：沿XY平面平移整个图形，不可沿Z轴平移
* 中键拖动 + CTRL：在3D空间平移场景
* 旋转滚轮：放大/缩小
* 滚轮 + CTRL：更改视角角

## 绘图

PyqtGraph提供了四种基本的绘图方式：pyqtgraph.plot()、PlotWidget.plot()、PlotItem.plot()、GraphicsLayout.plot()。

* pyqtgraph.plot(): 创建一个新的窗口来显示数据
* PlotWidget.plot()： 在已有的窗口添加一个新的图形     Widget(小工具，小部件，比如一些按钮之类的)
* PlotItem.plot()： 在已有的窗口添加一个新的图形
* GraphicsLayout.plot()： 添加新的图形到画图网格上，用于在一个画图板上创建多个子图

四种方法所接受的基本参数：

* x-坐标X数据。如果未指定，将使用连续的整数
* y-坐标Y数据
* pen-画线条时使用的笔。设置为None时表示禁用线条
* symbol-用于指定数据点所使用的标记类型（如正方形、圆形、三角等）
* symbolPen-绘制标记轮廓时要使用的笔
* symbolBrush-填充标记时要使用的画笔
* fillLevel-填充绘图曲线下的区域
* brush-在曲线下方填充时使用的笔刷

# 一些内置实例

```py
import pyqtgraph.examples
pyqtgraph.examples.run()
```

不知道是什么情况，ubantu系统下一直运行不了这个（这里记一下错误信息）

```dos
qt.qpa.plugin: Could not load the Qt platform plugin "xcb" in "" even though it was found.
This application failed to start because no Qt platform plugin could be initialized. Reinstalling the application may fix this problem.

Available platform plugins are: eglfs, linuxfb, minimal, minimalegl, offscreen, vnc, wayland-egl, wayland, wayland-xcomposite-egl, wayland-xcomposite-glx, webgl, xcb.

已放弃 (核心已转储)
```

> 解决方案：`sudo apt-get install libxcb-xinerama0`

原因：我的linux缺了很多包2333（心里千万草泥马奔过~~我怕不是装了个假的ubantu~~）

怎么让界面显示出来又是个问题(下课后回去研究)