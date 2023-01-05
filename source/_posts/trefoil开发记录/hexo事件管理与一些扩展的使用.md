---
title: 从零开始的异世界主题开发生活-hexo事件管理与扩展使用
categories:
  - trefoil 开发日志
tags:
  - hexo
  - Course
  - theme-trefoil
description: 开了坑总得干点活，hexo的主题不是那么好整……特别是hexo那糟糕的文档下，开发真的很麻烦
abbrlink: 55440
date: 2023-01-05 23:00:00
updated: 2023-01-05 23:00:00
---

## 前言

想起一年半以前，想要对我的初版博客进行整体的魔改，然后设计了我的首版卡片（并不会写但是设计粗来了）。然而一年半过去了，我的博客经历了大大小小的魔改调整，文章页改完了卡片反而觉得不搭了。改着改着又不太喜欢文章卡片式设计等等。

种种原因到我想放弃 butterfly。用店长的话说就是，魔改到现在也不算在坚守 bf 了。

于是我开始寻思着要不要换主题，而 stellar 很合我心意，但又有我很中意但又太复杂且定位不符的 wiki 功能。于是思来想去，决定自己开发一个主题吧，也学一学自己拒绝了两年的前端。

废话完了，开始讲记录吧。hexo 主题的开发对于我这个前端半生不熟的人来讲还是很有难度的。本身也没有画过时间系统的学习前端。js 最多就是魔改 bf 的时候稍微模仿着写一点点的程度，css 也就只有常用的一些相对熟悉一点，动画、布局、定位这些毫无经验。因此记录是必要，本身写项目就是一种很好的学习方式。

另外记录的是 hexo 本身开发的经历，给一些不满足于魔改的想开发主题的朋友做做参考也行。

{% note purple 'far fa-hand-scissors' flat %}友情感谢 [@mufanc](https://blog.mufanc.xyz/) 同学在开发 rust 博客框架途中被我拐来~~（甚至弃坑）~~做 `trefoil` 主题的开发，这里着重感谢！{% endnote %}

---

## hexo 开发常用-事件系统与扩展api使用

### 事件: hexo.on

hexo 的文档可谓一塌糊涂，令人开发都不知道何处动笔，只能参考前人主题去做些尝试。当还没确定布局的时候，需要想好自己要哪些脚本进行辅助构建。`hexo.on` 提供的事件钩子可以让我在一些阶段进行一些数据的构建（例如 stellar 的 wiki 数据结构），也可以在使用 hexo 的时候出现 banner 来体现使用了自己的主题。

[hexo 事件文档](https://hexo.io/zh-cn/api/events)

比如在 hexo 运行开始，提示一条主题使用语句：

```js
hexo.on('ready', () => {
  const { version } = require('../../package.json')
  hexo.log.info(` Welcome to trefoil! ${version} `)
})
```

运行出现如下字样：

```bash
PS C:\MyPersonProject\blog\theme-trefoil-demotest> hexo s
INFO  Validating config
INFO   Welcome to trefoil! 0.0.1
INFO  Start processing
INFO  Hexo is running at http://localhost:4000/ . Press Ctrl+C to stop.
```

而在主题开发中，最常用的是 `generateBefore` 和 `generateAfter` 这两个事件。以 `generateBefore` 为例：

例如我想在 trefoil 主题中构建一个轻量化的类似 wiki 的合集功能，需要在文章渲染前对所有原始 maekdown 文件的 `front-matter` 进行统计并构建对象，就需要在这个阶段进行构建（其实可以在过滤器相似的阶段来构建，但这明显不是过滤器应该做的事），然后将其设为全局变量供文章渲染阶段使用。

```js
hexo.on('generateBefore', () => {
  const series_dist = {}
  const posts = hexo.locals.get('posts')
  // ...series_dist 构建
  hexo.locals.set('series_dist', () => series_dist)
})
```

### 过滤器 hexo.extend.filter

过滤器是 hexo 中主观上觉得 api 相对完全的一个功能（因为可以说只有它有完整的调用事件列表，相比 hexo.on 能干的事感觉多了不少），甚至也只能在过滤器中去干一些感觉就不应该由它做的事。

前人在过滤器最常见使用的两个功能是修改渲染前/后文件和选择性生成css。后者我还没使用到，前者倒是已经实战了一下。

比如渲染前加入 abbrlink：（这部分代码是 mufanc 帮我写的，我为了合集功能做的主副标题特性与现有的 abbrlink 插件不兼容）

```js
hexo.extend.filter.register('before_post_render', function (data) {
  if (data.abbrlink || data.layout !== 'post') return

  const config = this.theme.config.abbrlink || this.config.abbrlink || {};
  if (!config.enable) return

  const mirror = front.parse(data.raw);

  const abbrlink = hash(data.title, data.subtitle, data.series_name, data.series_index);
  mirror.abbrlink = abbrlink;
  data.abbrlink = abbrlink;

  fs.writeFileSync(data.full_source, '---\n' + front.stringify(mirror), 'utf-8')

  hexo.log.info(`Generate link [${abbrlink}] for post [${data.source}][${data.title+(data.subtitle?(': '+data.subtitle):'')}]`);
}, 15);
```

它向渲染前的原始文件开头的 front-matter 加入了 abbrlink 参数。而下面这个栗子则是向渲染后的 html DOM 进行代码插入，我需要向代码块中插入几行行代码来实现代码复制和代码展开功能：

```js
hexo.extend.filter.register('after_post_render', function (data) {
  const config = this.theme.config
  if (config.code.height_limit_enable) {
    if (!data.permalink.match(/.*(?:\.html|\/)$/)) {
      return;
    }

    let $ = cheerio.load(data.content)
    $('<figcaption></figcaption>').insertBefore('figure.highlight table:not(figcaption + *)')
    $('figure.highlight figcaption').append('<i class="ri-file-copy-line"></i>')
    $('figure.highlight table').before('<div class="code-expand-btn"><i class="ri-arrow-down-s-fill"></i></div>')
    data.content = $.html();
  }
});
```

原先的 DOM 结构如下：

```html
<figure class='highlight'>
    <figcaption> /*可能不存在的标题*/
        <span>标题</span>
    </figcaption>
    <table>
        <tr>
            <td class='gutter'>...</td> /*可能不存在的序号*/
            <td class='code'><pre>...</pre></td> /*代码块*/
        </tr>
    </table>
</figure>
```

经过过滤器修改后的结构如下：

```html
<figure class='highlight'>
    <figcaption> /*必定存在的figcaption*/
        <span>标题</span> /*可能不存在的标题*/
        <i class="ri-file-copy-line"></i> /*复制图标*/
    </figcaption>
    <div class="code-expand-btn"><i class="ri-arrow-down-s-fill"></i></div> /*展开图标*/
    <table>
        <tr>
            <td class='gutter'>...</td> /*可能不存在的序号*/
            <td class='code'><pre>...</pre></td> /*代码块*/
        </tr>
    </table>
</figure>
```

足见过滤器功能之强大。

### 生成器 hexo.extend.generator

生成器用于生成文章路由，比如我们无需创建 md 文件就可以利用模版生成 404 页面：

```js
hexo.extend.generator.register('404', function (locals) {
  return {
    path: '/404.html',
    layout: ['404']
  }
});
```

这部分功能也还没怎么用。

### 辅助函数 hexo.extend.helper

辅助函数帮助您在模板中快速插入内容，有点类似与 pug 中的 `mixin`。但是显然用 js 功能会更加强大一点，同时也可以与前面我们生成的合集数据结构对接。

例如从合集数据结构中生成合集目录供模板调用：

```js
hexo.extend.helper.register('__series_toc', function (page) {
  const series_dist = hexo.locals.get('series_dist')
  const toc_str = []
  // ...
  return toc_str.join('')
})
```

之后我就可以在文章页模版使用辅助函数进行调用：

```python
!=__series_toc(page)
```

## 结语

文档不能不吐槽，api 提供的我感觉 hexo 的项目结构也不咋合理。但能用还是别自己造轮子了，起码能用。。。