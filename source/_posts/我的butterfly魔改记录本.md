---
title: '个人哔哔: 我的butterfly魔改记录'
categories: 贰猹随笔
tags:
  - Diary
  - Course
description: 一如魔改深似海，一直魔改一直耍
abbrlink: 10567
date: 2021-02-20 20:43:07
---
其实butterfly确实是hexo主题里为数不多的<b style="color:red">优雅</b><del>（花里胡哨）</del>的主题了

但看了[@冰卡诺老师](https://zfe.space/)和[@Aki店长](https://akilar.top/)的博客后，十分感慨：<b style="color:cyan">人与人的butterfly不能一概而论</b>

所以，学习<del>（白嫖）</del>着他们的教程，我也开始走上魔改bf之路

--------

> 但店长说的好：<b style="color:cyan">魔改一时爽，升级火葬场</b>

记录魔改历程也是为了以后主题更新能找到回家的路（毕竟主题更新相当于把大部分魔改推倒重来）

所以也记录和备份我修改/添加过的文件，方便查询

```
root
├─source
│   ├─_data
│   │   └─slider.yml
└─themes
    └─butterfly
        ├─layout
        │   ├─includes
        │   │   ├─page
        │   │   │   └─flink.pug
        │   ├─index.pug
        │   └─sliderbar.pug
        └─source
            ├─css
            │   ├─_layout
            │   │   └─categoryBar.styl
            │   │   └─swiperstyle.styl
            │   ├─_page
            │   │   └─flink.styl
            │   ├─commentsbar.css
            │   ├─index.styl
            │   └─add.css
            └─js
                └─swiper_init.js

```

--------

# 主题源码修改部分

## 留言板动态弹出信封样式

> 参考教程：店长的[Envelope Style Comments Bar](https://akilar.top/posts/e2d3c450/)

新增的主题源码：  
`[root]\themes\butterfly\source\css\commentsbar.css`

--------

## 友链样式魔改

> 参考教程：店长的[Friend Link Card Beautify](https://akilar.top/posts/57291286/)

修改的主题源码：  
`[root]\themes\butterfly\layout\includes\page\flink.pug`  
`[root]\themes\butterfly\source\css\_page\flink.styl`

--------

## 首页磁贴

> 参考教程：店长的[Categories Magnet](https://akilar.top/posts/a9131002/)

修改的主题源码：  
`[root]\themes\butterfly\layout\index.pug`

新增的主题源码：  
`[root]\themes\butterfly\source\css\_layout\categoryBar.styl`

-------

## 首页置顶轮播图

> 参考教程：店长的[Slider Bar](https://akilar.top/posts/8e1264d1/)

新增的主题源码：  
`[root]\themes\butterfly\layout\includes\sliderbar.pug`  
`[root]\themes\butterfly\source\js\swiper_init.js`  
`[root]\themes\butterfly\source\css\_layout\swiperstyle.styl`

修改的主题源码：  
`[root]\themes\butterfly\source\css\index.styl`

新增配置文件：  
`[root]\source\_data\slider.yml`

--------

# 非主题源码修改区

## 双栏卡片主页文章

> 参考文章：冰老师的[教程：基于Butterfly主题的双栏卡片主页文章css样式](https://zfe.space/post/52914.html)

(我这里直接在主题配置文件引入冰老师的css，所以不涉及其他修改)

--------

## 字体样式修改

> 参考文章：冰老师的[Custom Beautify](https://akilar.top/posts/ebf20e02/)

```CSS
@font-face{
    font-family:'aqqxs' ;  /* 字体名自定义即可 */
    src:url('https://cdn.jsdelivr.net/gh/2x-ercha/cdn-for-try/fonts/FXAiQingQiXiangSuo.ttf'); /* 字体文件路径 */
    font-display : swap;
}

h1,h2,h3,h4,h5,h6,
a#site-name,span#subtitle,a.site-page,
a.title,
#aside-content,
a.article-sort-item-title,
a.article-title,
a.categoryBar-list-link,
a.blog-slider__title,
.article-sort-title,
.tag-cloud-title,
.category-title,
a.category-list-link {
    font-family: 'aqqxs', sans-serif;
}
```

--------

## 首页磁铁字体微调

其实就是用阴影给分类的标题上了描边

```CSS
a.categoryBar-list-link {
    text-shadow: #0000001a 1px 0 0, #000000 0 1px 0, #000000 -1px 0 0, #00000000 0 -1px 0;
}
```

--------

## 鼠标样式及页脚半透明

> 参考文章：小康的[Hexo 博客之 butterfly 主题优雅魔改系列](https://www.antmoe.com/posts/a811d614/index.html)

```CSS
/* 鼠标样式 */
body {
    cursor: url(https://cdn.jsdelivr.net/gh/sviptzk/HexoStaticFile@latest/Hexo/img/default.cur),
        default;
}
a,
img {
    cursor: url(https://cdn.jsdelivr.net/gh/sviptzk/HexoStaticFile@latest/Hexo/img/pointer.cur),
        default;
}

/* 页脚半透明 */
#footer {
    background: rgba(255,255,255,.15);
    color: #000;
    border-top-right-radius: 20px;
    border-top-left-radius: 20px;
    backdrop-filter: saturate(100%) blur(5px)
}

#footer::before {
    background: rgba(255,255,255,.15)
}

#footer #footer-wrap {
    color: var(--font-color);
}

#footer #footer-wrap a {
    color: var(--font-color);
}
```

--------

## Twikoo评论框高度

```CSS
.el-textarea__inner {
  /* min-height: 75px; */
  /* height: 75px; */
  min-height: 210px !important;
  height: 210px !important;
}
```

--------

## 卡片背景透明度颜色重写

**PS: 这个其实准备重新弄了**

```CSS
:root {
  /* --card-bg: #fff; */
  --card-bg: #ffefefd9;
}

[data-theme="dark"] {
  /* --card-bg: #121212; */
  --card-bg: #12121288;
  --btn-hover-color: #787878;
  --btn-bg: #1f1f1f;
  --btn-hover-color: #ff3f3f;
  --btn-bg: #a153ff;
  /* --font-color: rgba(255,255,255,0.7); */
  /* --hr-border: rgba(255,255,255,0.4); */
  --font-color: rgb(255, 255, 255);
  --hr-border: rgb(161, 83, 255);
}
```

-------

# 另外这里给店长打个广告

**butterfly魔改售后服务中心**<del>（其实就是店长自己的群）</del>

<img src=https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/akicandyroom.jpg alt='🧊Akilarの糖果屋' style='max-height:500px'>