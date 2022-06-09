---
title: rust写个操作系统——课程实验blogos移至armV8深度解析
categories: BlogOS_armv8
tags:
  - Course
  - os
  - rust
  - blogos
description: HNU 操作系统课程实验：将 blogos 移植到 armv8 架构。
abbrlink: 16433
date: 2022-04-17 20:01:00
updated: 2022-05-21 21:19:00
sticky: 100
---

## 前言

不能不说，我看着实验指导书给好的现成的代码，不知道这些代码到底在干什么。我陷入了沉思，作为一个想学习嵌入式系统的学生而言，我似乎不能从这个实验中学到些什么。

然而这些知识，理应是一个想做嵌入式的人应该有的，但看着现成代码再看注解，大部分情况下还是一头雾水。老师说理解原理，但又理解不能，于是去翻阅资料。只有一步步实现，才能更好的知道我们为什么要这么做。

很多的代码细节，我也仍然没办法去一行行解释。面对想学的东西，更多的还是保持求知欲和不厌其烦。

路漫漫其修远兮，吾将上下而求索，说的莫若如是。

{% note primary %}
**仓库地址**：[https://github.com/2X-ercha/blogOS-armV8](https://github.com/2X-ercha/blogOS-armV8)，能不能求一个`star`呢？
{% endnote %}

{% note info %}
**想要速通实验**？请转 [AcmeZone: BlogOS：ARM v8之旅](https://acmezone.top/2022/02/26/BlogOS%EF%BC%9AARM-v8%E4%B9%8B%E6%97%85/)
{% endnote %}

## 目录

{% note success %}

* **2022-04-18 实验一完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab1](https://github.com/2X-ercha/blogOS-armV8/tree/lab1)

  文章地址: [https://noionion.top/adfdff.html](https://noionion.top/adfdff.html)

* **2022-04-19 实验二完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab2](https://github.com/2X-ercha/blogOS-armV8/tree/lab2)

  文章地址: [https://noionion.top/4735f31b.html](https://noionion.top/4735f31b.html)

* **2022-04-24 实验四完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab4](https://github.com/2X-ercha/blogOS-armV8/tree/lab4)

  文章地址: [https://noionion.top/a4c75e16.html](https://noionion.top/a4c75e16.html)

* **2022-04-25 实验五完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab5](https://github.com/2X-ercha/blogOS-armV8/tree/lab5)

  文章地址: [https://noionion.top/82ab7cd4.html](https://noionion.top/82ab7cd4.html)

* **2022-04-26 实验六完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab6](https://github.com/2X-ercha/blogOS-armV8/tree/lab6)

  文章地址: [https://noionion.top/ec262d5c.html](https://noionion.top/ec262d5c.html)

* **2022-05-14 实验七完成**

  仓库地址：[https://github.com/2X-ercha/blogOS-armV8/tree/lab7](https://github.com/2X-ercha/blogOS-armV8/tree/lab7)

  文章地址: [https://noionion.top/b484f477.html](https://noionion.top/b484f477.html)

* **2022-06-09 实验八解析完成**

  文章地址: [https://noionion.top/49749.html](https://noionion.top/49749.html)

  * 第一部分：`identity mapping`直接映射（外设映射到`0-1g`部分）

    仓库地址：[分支名：lab8-identity_mapping_0-1g - https://github.com/2X-ercha/blogOS-armV8/tree/lab8-identity_mapping_0-1g](https://github.com/2X-ercha/blogOS-armV8/tree/lab8-identity_mapping_0-1g)

  * 第一部分补充：自行实验部分-`identity mapping`偏移映射与页面共享（外设映射到`2-3g`部分）

    仓库地址：[分支名：lab8-identity_mapping_2-3g - https://github.com/2X-ercha/blogOS-armV8/tree/lab8-identity_mapping_2-3g](https://github.com/2X-ercha/blogOS-armV8/tree/lab8-identity_mapping_2-3g)

  文章地址: [https://noionion.top/16886.html](https://noionion.top/16886.html)

  * 第二部分上：非`identity mapping`映射（内核置于下半部分-原始地址，外设置于虚拟页`0xffffffff0000000`开始的页处）

    先尝试不用二级页表，用块映射实现

    仓库地址：[分支名：lab8-block_mapping - https://github.com/2X-ercha/blogOS-armV8/tree/lab8-block_mapping](https://github.com/2X-ercha/blogOS-armV8/tree/lab8-block_mapping)

  * 第二部分下：非`identity mapping`映射（内核置于下半部分-原始地址，外设置于虚拟页`0xffffffff00000000`开始的页处）

    进一步改用二级页表实现

    仓库地址：[分支名：lab8-multi-level_page_tables - https://github.com/2X-ercha/blogOS-armV8/tree/lab8-multi-level_page_tables](https://github.com/2X-ercha/blogOS-armV8/tree/lab8-multi-level_page_tables)

{% endnote %}

## 日志

{% note danger %}
* **2022-05-13 详解勘误并修改**

  跟老师探讨后，发现前六个实验有一部分发生较大的理解错误。在此进行一次勘误。主要勘误部分有：

  * panic的作用 [（定位到勘误点）](https://noionion.top/adfdff.html#能跑起来的裸机程序尝试)

  * 程序维持执行的`loop`和汇编`wfi`的作用 [（定位到勘误点）](https://noionion.top/a4c75e16.html#时钟中断服务)

  * 最小化内核构建中的部分错误

{% endnote %}
