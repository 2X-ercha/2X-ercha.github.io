---
title: html入门学习（一）
categories:
  - 前端入门学习
tags:
  - html
top_img: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/pagecode.jpg
# cover: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/covercode.jpg
description: 来学学新东西
abbrlink: 10752
date: 2021-02-11 19:57:27
updated: 2021-02-11 19:57:27
---
**卧槽，大年三十我在干嘛。~~我在水文章（bushi)~~ 我在学新知识**

--------

我其实也不怎么知道我学前端知识干啥。可能只是想有更广的知识面吧，反正**立下了大一下的自学前端知识（`html,css,js`三件套）的flag**

趁着春节这周ACM不用训练，时间较好安排，不妨开始`html`喽

-------

我就不在这里重复说html是什么，做什么的。这里只是作为笔记的整理，适合翻阅查看而已。以下开始正题：

-------

## 基本内容

```html
<!DOCTYPE html>

<html>

    <head>
        <title>基础格式</title>
        <meta charset="utf-8">
    </head>

    <body>
        <h1>标题</h1>
        <p>段落</p>
    </body>

</html>
```
`<!DOCTYPE html>` 声明这是个html文档（虽然我觉得文件后缀名就能判断出来）

`<html></html>` html的开头结尾

`<head></head>`必要的声明，比如标题，编码方式，还有此文档外部引入的css等等，都在这里声明（此部分不会在网页中显示）

`<body></body>`文档的主体部分

所以文章的整个基本结构应该是

```
html
- head
- body
```

--------

## 颜色

比较可能会在md里面打的：

<b style="color: red;">常用红色加粗文本</b><br/>`<b style="color: red;">常用红色加粗文本</b>`
<b style="color: orange;">常用橙色加粗文本</b><br/>`<b style="color: orange;">常用橙色加粗文本</b>`
<b style="color: yellow;">常用黄色加粗文本</b><br/>`<b style="color: yellow;">常用黄色加粗文本</b>`
<b style="color: green;">常用绿色加粗文本</b><br/>`<b style="color: green;">常用绿色加粗文本</b>`
<b style="color: cyan;">常用青色加粗文本</b><br/>`<b style="color: cyan;">常用青色加粗文本</b>`
<b style="color: blue;">常用蓝色加粗文本</b><br/>`<b style="color: blue;">常用蓝色加粗文本</b>`
<b style="color: purple;">常用紫色加粗文本</b><br/>`<b style="color: purple;">常用紫色加粗文本</b>`
<strong style="color: violet;">还有strong加粗</strong><br/>`<strong style="color: violet;">还有strong加粗</strong>`

--------

## 其他常用

<b style="color: white;">b标签是加粗</b>
<strong style="color: cornsilk;">strong标签也是加粗</strong>
<big style="color: red;">big标签是放大</big>
<small style="color: blueviolet;">small标签是缩小</small>
<em style="color: pink;">em是斜体</em>
<i style="color: cornsilk;">i也是斜体</i>
<sup style="color: cyan;">sup上标</sup>正常<sub style="color: cyan;">sub下标</sub>
<ins style="color: orange;">ins标签插入字（下划线）</ins>
<del style="color: violet;">del标签删除字</del>

--------

## 代码？

对以下东西比较迷惑

<dfn>定义项目</dfn><br>
<code>一段电脑代码 print("Hello World")</code><br>
<samp>计算机样本</samp><br>
<kbd>键盘输入</kbd><br>
<var>变量</var>

```html
<!--对以下东西比较迷惑-->
<dfn>定义项目</dfn><br>
<code>一段电脑代码 print("Hello World")</code><br>
<samp>计算机样本</samp><br>
<kbd>键盘输入</kbd><br>
<var>变量</var>
<!--迷惑结束-->
```

--------

## 引用

<abbr title="abbr标签缩写，可以隐藏内容呀">鼠标移到我上边看内容</abbr><br/>`<abbr title="abbr标签缩写，可以隐藏内容呀">鼠标移到我上边看内容</abbr>`

`<address> `标签定义文档作者/所有者的联系信息。
如果`<address>` 元素位于` <body> `元素内部，则它表示该文档作者/所有者的联系信息。
如果` <address> `元素位于` <article>` 元素内部，则它表示该文章作者/所有者的联系信息。
`<address>` 元素的文本通常呈现为斜体。大多数浏览器会在该元素的前后添加换行。
如

<address>
Written by <a href="mailto:noionion@outlook.com">noionion</a>.<br/> 
Visit us at:<br/>
<a href="https://noionion.top/">noionion.top</a><br/>
HNU univsity Changsha Hunan<br/>
Chine
</address>

```
<address>
Written by <a href="mailto:noionion@outlook.com">noionion</a>.<br/> 
Visit us at:<br/>
<a href="https://noionion.top/">noionion.top</a><br/>
HNU univsity Changsha Hunan<br/>
Chine
</address>
```

该段落文字从左到右显示。<br/>
<bdo dir="rtl">该段落文字从右到左显示。</bdo><br/>`<bdo dir="rtl">该段落文字从右到左显示。</bdo>`

<blockquote cite="http://www.worldwildlife.org/who/index.html">
长文本引用blockquote<br/> 定义引用cite<br/>
和md的引用是一样的
</blockquote>

```html
<blockquote cite="http://www.worldwildlife.org/who/index.html">
长文本引用blockquote<br/> 定义引用cite<br/>
和md的引用是一样的
</blockquote>
```

<q style="color: lightblue;";">短文本引用q（有点类似于加个双引号？）</q><br/><br/>`<q style="color: lightblue;";">短文本引用q（有点类似于加个双引号？）</q><br/>`

<cite>使用cite标签来定义作品的标题</cite><br\>`<cite>使用cite标签来定义作品的标题</cite>`

--------

暂时写到这里（剩下的还没学啦）