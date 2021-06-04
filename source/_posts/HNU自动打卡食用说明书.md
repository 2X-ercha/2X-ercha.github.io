---
title: HNU自动打卡食用说明书
categories:
  - 实用项目
tags:
  - Python
  - Project
top_img: 'https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/HNU.png'
description: 不知道怎么用自动打卡？使用说明书来啦！
abbrlink: 33550
hidden: true
date: 2021-04-22 20:00:00
updated: 2021-06-04 23:16:00
---

应广大同学们的要求，我还是把自动打卡项目公开了emmm。

项目地址：https://github.com/2X-ercha/HNU-AutoClockIn

教程地址：https://noionion.top/7431.html

然而我公开的时候是在太懒，不想写说明书，就很草率地写了个很粗糙的README。~~恰巧博客也咕咕咕了好久没有更新，干脆来水一篇博客~~

开始正题：

{% note warning simple %}
**免责声明** 请在法律循序范围内使用，当发生发烧等异常现象是仍需如实填报。若用户使用此脚本后违反相关法律法规造成损失，将由用户自行承担，作者不承担一切责任！
{% endnote %}

{% note warning simple %}
**请在法律循序范围内自行参考制作自己的打卡脚本，当发生发烧等异常现象是仍需如实填报**
{% endnote %}

**本说明针对广大无github使用基础的HNUer编写**，如果你是github深度用户，请掠过此篇说明书

--------

## 准备

* 一个github账号（怎么注册我就不写了）

--------

## 步骤

### 1，fork本项目

在登录github的前提下，点击进入我已写好的脚本仓库地址[HNU疫情防控自动打卡脚本](https://github.com/2X-ercha/HNU-AutoClockIn)，点击右上角的fork

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422191801.png)

之后会跳转到自己的同名仓库（白嫖完我的代码啦），如下所示：

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422192042.png)

--------

### 2，设置个人门户账号密码和打卡地址

点击仓库的`setting`后在左侧栏点击`Secrets`项

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422192232.png)

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422192317.png)

点击右上角的`New repository secret`新建如下4个键值对

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422192422.png)


| 键                       | 值                                              |
| ------------------------ | ----------------------------------------------- |
| USER                     | 学号                                            |
| PASSWORD                 | 密码                                            |
| REALPROVINCE_CITY_COUNTY | 例如： 湖南省,长沙市,岳麓区（请用英文逗号隔开）    |
| REALADDRESS              | 具体地址                                        |

设置后如图所示：

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422193007.png)

至此打卡需要提交的信息已经齐了

--------

### 3，启用action

点击`actions`，并同意启用服务

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422193320.png)

然后

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422193742.png)

现在每天凌晨的1点和6点钟都会自动帮你打卡啦（第一次食用建议检查一下，貌似github仓库fork过去action会抽风，解决办法在下面**提问**处）

--------

## 手动开启

当然猹很贴心地提供了手动打卡的方式

点击仓库`fork`旁的`star`键就可以手动运行啦

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422193829.png)

你可以点进去查看运行结果

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422193944.png)

![](https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/20210422195444.png)

-------

## 提问：

* **打卡时间是？**

每天凌晨的1点和6点钟，各尝试3次（理论上一次即可，不过得防止github action虚拟机创建失败）

* **我怎么不打开网页或者公众号就知道我打卡成功了没？**

因为我设的是打卡到成功为止，一般而言是成功的。什么会导致打卡失败呢？当然是学校服务器崩溃的时候啦！github action在脚本连续运行6小时后也会自动停止并给你发送一封报错邮件。如果你在早上7点到8点收到了邮件，说明打卡炸了，需要自己注意一下喽

（不过这种时候各专业群也应该炸开锅了吧）

* **我使用了这个脚本但他没有自动运行？**

github的仓库fork过去后貌似会抽风，不给你自动运行

**解决办法**：**手动star启用一次（貌似不行）**或者**随便找个文件在无关紧要的地方加个空格或者换行**，然后隔天查看一下

* **我有反馈要在哪写？**

请在下方留言处留言

--------

如果没问题那恭喜你，可以愉快地晚期~~（忘记打卡）~~啦！