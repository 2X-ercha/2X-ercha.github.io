---
title: html入门学习（一）
categories:
  - Code
  - html
tags:
  - html
top_img: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/pagecode.jpg
cover: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/covercode.jpg
description: 来学学新东西
abbrlink: 10752
date: 2020-02-11 19:57:27
updated: 2020-02-11 19:57:27
---
**卧槽，大年三十我在干嘛。~~我在水文章（bushi)~~ 我在学新知识**

--------

我其实也不怎么知道我学前端知识干啥。可能只是想有更广的知识面吧，反正**立下了大一下的自学前端知识（`html,css,js`三件套）的flag*

趁着春节这周ACM不用训练，时间较好安排，不妨开始`html`喽

-------

我就不在这里重复说html是什么，做什么的。这里只是作为笔记的整理，适合翻阅查看而已。以下开始正题：

-------

# 基本内容

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

<h1>文本格式化控制</h1>
 <p style="color: #888fff;">
<b style="color: white;">b标签是加粗</b>
<strong style="color: cornsilk;">strong标签也是加粗</strong>
<br/><br/>
<big style="color: red;">big标签是放大</big>
正常
<small style="color: blueviolet;">small标签是缩小</small>
<br/><br/>
<em style="color: pink;">em是斜体</em>
<i style="color: cornsilk;">i也是斜体</i>
<br/><br/>
<sup style="color: cyan;">sup上标</sup>
正常
<sub style="color: cyan;">sub下标</sub>
<br/><br/>
<ins style="color: orange;">ins标签插入字（下划线）</ins>
<br/><br/>
<del style="color: violet;">del标签删除字</del>
<br/><br/>
</p>