---
title: stl的正确食用方式（不定时更新）
categories:
  - C++学习笔记
tags:
  - C++
top_img: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/pagecode.jpg
# cover: https://noionion-picture-bed.oss-cn-hangzhou.aliyuncs.com/img/covercode.jpg
description: 被迫复习
abbrlink: 10146
date: 2020-11-28 14:48:27
updated: 2020-12-20 19:30:27
---
# C++ - STL （一个标准模版库）

(不定时更新)

STL 里包含了许多我们特别常用的标准数据结构和算法的模版，比如栈(stack)，队列(queue)，映射(map)，优先队列(priority_queue)，还有向量(priority_queue)等等。

有了这样一个模板库，像我这种懒人终于不需要手打一些数据结构啦（会是会，但我就是不想打）

再着，因为下个月月底得打ACM的新生赛了，因为各种各样的事咕了好久没有复习C++了，总归得开始点知识储备

所以得充实充实自己的脑袋瓜啦~~（啊，脑壳好疼）~~

--------

> 2020/11/29 突然想起来我有带《算法设计入门经典》，里面也有一大块是讲 STL 的，我决定就按着它的顺序复习（和学习）了

## 复习时间表

以此时间表来观察鸽子有多鸽

> 2020/11/28 栈和队列

> 2020/11/29 排序检索

> 2020/11/30 不定长数组

> 2020/12/03 集合

> 2020/12/20 映射 ~~（你看，咕咕咕了好久）~~

--------

# 排序与检索

## 排序(sort)

sort 函数默认使用数组元素默认的大小进行升序排序，只有在需要按照特殊依据进行排序时才需要传入额外的比较函数。  
我习惯上会定义成cmp  
原理嘛~~~其实就是快速排序(quicksort)

### 导入

sort 所在的库文件是 <algorithm>，所以：

```cpp
#include <algorithm>
using namespace std;
```

### sort函数的使用

假设一个数组 a 的 [x,y) 部分需要排序，则：
```cpp
sort(a+x,a+y); //对数组a的 [x,y) 进行升序排序，直接改变这一区间的元素顺序
```

如果要降序，就需要传入比较函数了，方法和下面类似，这里不再打出

当然也可以对结构体等使用，这时就得传入比较函数来确定需要比较的函数，例如

```cpp
//关键字排序
struct scores{
    int Chinese,Math;
}class1;

bool cmp(class1 a,class1 b){ //关键字排序规则，降序
    if(a.Chinese!=b.Chinese)return a.Chinese>b.Chinese;
    return a.Math>=b.Math;
}

int main(){
    sort(a+x,a+y,cmp);
}
```

实际上对于任意的对象，有了cmp和重载＜号，sort()都是可以进行相关的排序的（比如后面的victor，调用的方式改成了`sort(v.begin(),v.end())`）

## 检索

lower_bound() 和 upper_bound() 所在的库文件也是 <algorithm>

### lower_bound (应用于有序区间)

这是二分查找（binary search）的一种版本，试图在已排序的[first,last)中寻找元素value：

如果[first,last)具有与value相等的元素(s),便返回一个迭代器，指向其中第一个元素；

如果没有这样的元素存在，便返回“假设这样的元素存在时应该出现的位置”，

也就是说，**它返回一个迭代器，指向第一个“不小于value”的元素；**

如果value大于 [first,last) 内的任何一个元素，则返回last。

### upper_bound (应用于有序区间)

算法upper_bound是二分查找（binary search）法的一个版本。它试图在已排序的[first,last)中寻找value。更明确地说，它会返回“在不破坏顺序的情况下，可插入value的最后一个合适的位置”。

由于STL规范“区间圈定”时的起头和结尾并不对称（是的，[first,last)包含first但不包含last）,所以upper_bound与lower_bound的返回值意义大有不同。如果你查找某值，而它的确出现在区间之内，则lower_bound返回的是一个指向该元素的迭代器。然而upper_bound不这么做，因为upper_bound所返回的是在不破坏排序状态的情况下，value可被插入“最后一个”合适位置。

所以，**如果value存在，那么它返回的迭代器将指向value的下一位置，而非指向value本身。**

### lower_bound() 和 upper_bound() 的使用

```cpp
int pos1=lower_bound(a+x,a+y,value);
int pos1=upper_bound(a+x,a+y,value);
```

--------

# 不定长数组：vector

这玩意我是基本没用到过啦，不过紫书后面的大整数类用的就是不定长数组（也可以称之为向量）。恰如它的翻译“不定长数组”，其实就是类似于 a- [] -

## 定义

```cpp
#include <vector>  //导入不定长数组的模板库
using namespace std;
```

建立各种数据类型的不定长数组

```cpp
vector<int> vectorint;
vector<double> vectordouble;
vector<char> vectorchar;
```

balabala……当然他可以是二维/三维的，such as:

```cpp
vector<int*> a;  //二维vector
vector<int**> a;  //三维vector
```

## 方法

### vector对象的存放/删除

```cpp
v.push_back(num);  //在数组的最后添加一个数据
v.pop_back();  //删除最后一个数据
v.erase(pos);  //删除pos位置的数据
v.erase(begin,end);  //删除 [begin,end) 区间的数据
v.insert(pos,elem);  //在pos位置插入数据elem
```

### vector对象的数据读取/查找

```cpp
num=v[i];  //正常就可以像数组这么用
v.front();  //传回第一个数据
v.back();  //传回最后一个数据
v.at(idx);  //传回索引idx所指的数据，如果idx越界，抛出out_of_range

v.begin();  //返回数组头的指针/迭代器
v.end();  //返回数组尾+1的指针/迭代器
v.rbegin();  //传回一个逆向队列的第一个数据
v.rend();  //传回一个逆向队列的最后一个数据的下一个位置
```

### vector对象的大小

```cpp
v.size();  //返回容器中实际数据的个数
v.max_size();  //得到vector最大可以是多大
v.resize(num);  //改变当前使用数据的大小，如果它比当前使用的大，者填充默认值
v.capacity();  //返回当前vector分配的大小
v.reserve(num);  //改变当前vector所分配空间的大小
v.clear();  //移除容器中所有数据
v.empty();  //判断容器是否为空
```

### vector对象的其他函数

```cpp
v1.swap(v2);  //交换两个vector（好像是这么用的，有待考证）
c.assign(beg,end);  //将[beg; end)区间中的数据赋值给c
c.assign(n,elem);  //将n个elem的拷贝赋值给c
get_allocator;  //使用构造函数返回一个拷贝
v.~ vector <Elem>();  //销毁所有数据，释放内存    
```

## 内存管理与效率（补充）

>  1》**使用reserve()函数提前设定容量大小，避免多次容量扩充操作导致效率低下。**  
>  (1) size()告诉你容器中有多少元素。它没有告诉你容器为它容纳的元素分配了多少内存。 
>  (2) capacity()告诉你容器在它已经分配的内存中可以容纳多少元素。那是容器在那块内存中总共可以容纳多少元素，而不是还可以容纳多少元素。如果你想知道一个vector或string中有多少没有被占用的内存，你必须从capacity()中减去size()。如果size和capacity返回同样的值，容器中就没有剩余空间了，而下一次插入（通过insert或push_back等）会引发上面的重新分配步骤。  
>  (3) resize(Container::size_type n)强制把容器改为容纳n个元素。调用resize之后，size将会返回n。如果n小于当前大小，容器尾部的元素会被销毁。如果n大于当前大小，新默认构造的元素会添加到容器尾部。如果n大于当前容量，在元素加入之前会发生重新分配。  
>  (4) reserve(Container::size_type n)强制容器把它的容量改为至少n，提供的n不小于当前大小。这一般强迫进行一次重新分配，因为容量需要增加。  

例如：

假定你想建立一个容纳1-1000值的vector<int>。没有使用reserve，你可以像这样来做：

```cpp
vector<int> v;
for (int i = 1; i <= 1000; ++i) v.push_back(i);
```

在大多数STL实现中，这段代码在循环过程中将会导致2到10次重新分配。（10这个数没什么奇怪的。记住vector在重新分配发生时一般把容量翻倍，而1000约等于210。）

把代码改为使用reserve，我们得到这个：

```cpp
vector<int> v;
v.reserve(1000);
for (int i = 1; i <= 1000; ++i) v.push_back(i);
```

这在循环中不会发生重新分配。

>  2》**使用“交换技巧”来修整vector过剩空间/内存**  
>  有一种方法来把它从曾经最大的容量减少到它现在需要的容量。这样减少容量的方法常常被称为“收缩到合适（shrink to fit）”。该方法只需一条语句：
```cpp
vector<int>(ivec).swap(ivec);
```

表达式vector<int>(ivec)建立一个临时vector，它是ivec的一份拷贝：vector的拷贝构造函数做了这个工作。但是，vector的拷贝构造函数只分配拷贝的元素需要的内存，所以这个临时vector没有多余的容量。然后我们让临时vector和ivec交换数据，这时我们完成了，ivec只有临时变量的修整过的容量，而这个临时变量则持有了曾经在ivec中的没用到的过剩容量。在这里（这个语句结尾），临时vector被销毁，因此释放了以前ivec使用的内存，收缩到合适。

--------

# 集合：set

~~在计算与人工智能概论课划水~~

`set` 就是数学上的集合——每个元素只出现一次，且从小到大排序。

和 `sort` 一样，自定义类型也可以构造 `set` ，但同样必须定义 `<` 运算符

原理上 `set` 使用了二叉树，同时，对于关联容器来说，不需要做内存拷贝和内存移动。set容器内所有元素都是以节点的方式来存储，其节点结构和链表差不多，指向父节点和子节点。插入的时候只需要稍做变换，把节点的指针指向新的节点就可以了。删除的时候类似，稍做变换后把指向删除节点的指针指向其他节点也OK了。这里的一切操作就是指针换来换去，和内存移动没有关系。

另外，在set中查找是使用二分查找

## 定义

```cpp
#include <set>
using namespace std;
```

常见的可以直接使用的类型 set 有

```cpp
set<int> intset;  //定义一个int类型的set容器
set<float> floatset;  //定义一个float类型的set容器
set<char> charset;  //定义一个char类型的set容器
set<string> strset;  //定义一个string类型的set容器
```

~~跟其他的容器看起来也差不多吧~~

## 方法

### set对象的存放

```cpp
s.insert(key_value);  //将key_value插入到set中 ，返回值是pair<set<int>::iterator,bool>，bool标志着插入是否成功，而iterator代表插入的位置，若key_value已经在set中，则iterator表示的key_value在set中的位置
s.inset(first,second);  //将定位器first到second之间的元素插入到set中，返回值是void

s.erase(iterator);  //删除定位器iterator指向的值
s.erase(first,second);  //删除定位器first和second之间的值
s.erase(key_value);  //删除键值key_value的值
```

**Ps set中的删除操作是不进行任何的错误检查的，比如定位器的是否合法等等，所以用的时候自己一定要注意。**

### set对象的数据读取

显然set容器是没办法向数组那样直接用下标查询的，查询只能靠迭代器来实现

```cpp
s.find(value);  //返回给定值value的指针，如果没找到则返回end()
s.lower_bound(key_value);  //返回第一个大于等于key_value的定位器
s.upper_bound(key_value);  //返回最后一个大于等于key_value的定位器
s.count();  //用来查找set中某个某个键值出现的次数
s.begin();  //返回set容器的第一个迭代器
s.end();  //返回set容器的最后一个迭代器
s.rbegin();  //传回一个逆向set的第一个数据
s.rend();  //传回一个逆向set的最后一个数据的下一个位置
```

**Ps count()这个函数在set并不是很实用，因为一个键值在set只可能出现0或1次，这样就变成了判断某一键值是否在set出现过了**

**Ps 注意begin()和end()函数是不检查set是否为空的，使用前最好使用empty()检验一下set是否为空.**

### set对象的大小

```cpp
s.empty();  //判断set容器是否为空
s.size();  //返回当前set容器中的元素个数
s.max_size();  //返回set容器可能包含的元素最大个数
s.clean();  //删除set容器中所有的元素
```

--------

# 映射：map

这个东西真的跟 python 的 `dict` 是差不多的（我觉得就一样！！！）

就是 key 到 value 的一个映射

简单的理解一下，其实就是数组的下标变成了非数字的各种数据类型，比如字符，字符串。

## 定义

```cpp
#include <map>
using namespace std: 
```

然后就跟其他的数据结构不太一样了

```cpp
map <char,int> char2int_map;
map <string,int> str2int_map;
```

当然也可以

```cpp
map <char,char> char2char_map;
map <char,string> char2str_map;
map <string,char> str2char_map;
```
## 方法

### map对象添加元素

```cpp
map<int, string> map1;  
map1.insert(pair<int, string>(1,"one"));
map1.insert(map<int, string>::value_ type(2,"two"));
map1[3]="three";  //map中最简单最常用的插入添加！
```

### map对象的查找

find()函数返回一个迭代器指向键值为key的元素，如果没找到就返回指向map尾部的迭代器。

```cpp
map<int, string >::iterator it;
it=map1.find(3);
if(it==maplive.end())
    cout<<"No find"<<endl;
else 
    cout<<"Find"<<endl;
```

### map对象的删除

```cpp
map<int ,string >::iterator it;
it=maplive.find(3);
if(it==maplive.end())
    cout<<"no find"<<endl;
else  maplive.erase(it);  //delete 112;
```

### map对象的交换

map中的swap不是一个容器中的元素交换，而是两个容器交换

```cpp
map1.swap(map2);
```

### 其他

map中的元素是自动按key升序排序,所以不能对map用sort函数

**以下列出map的其他各种方法** ~~（大同小异）~~

```cpp
m.begin();  //返回指向map头部的迭代器
m.clear();  //删除所有元素
m.count();  //返回指定元素出现的次数
m.empty();  //如果map为空则返回true
m.end();    //返回指向map末尾的迭代器
m.equal_range();  //返回特殊条目的迭代器对
m.erase();  //删除一个元素
m.find();   //查找一个元素
m.get_allocator();//返回map的配置器
m.insert(); //插入元素
m.key_comp();  //返回比较元素key的函数
m.lower_bound();  //返回键值>=给定元素的第一个位置
m.max_size();  //返回可以容纳的最大元素个数
m.rbegin(); //返回一个指向map尾部的逆向迭代器
m.rend();   //返回一个指向map头部的逆向迭代器
m.size();   //返回map中元素的个数
m.swap();   //交换两个map
m.upper_bound();  //返回键值>给定元素的第一个位置
m.value_comp();   //返回比较元素value的函数
```

**Ps：注意用map的时候大部分要标准化，比如大小写统一之类的**

--------


# 栈、队列和优先队列

## 栈(stack)

栈，用一个很神奇的东西描述一下——腔肠动物（有口无肝门）~~有点恶心~~

不过也道出了栈的本质——只有一个出入口~~（吃什么吐什么）~~

像一个桶，最底下的东西是最先放进去的，也只有在最后才能拿出来，进去的顺序是12345，出来的顺序就是54321。 

我们基本的写法是自己用数组模拟并定义相关的各种函数，但既然有了这样一个模板库，我们就方便很多了（如果你大致知道一点类就知道，其实C++已经把这些数据结构封装成了类,所以我们才可以直接调用）

以下开始正题：

### 定义

```cpp
#include <stack>  //导入栈的模板库
using namespace std;
```

栈里可以存放的数据类型挺多的，例如：

```cpp
stack <int> stkInt;  //一个存放int的stack容器。
stack <float> stkFloat;  //一个存放float的stack容器。
stack <string> stkString;  //一个存放string的stack容器。 
```
甚至可以定义个指针类型啥的~~（反正指针我忘记怎么打了）~~

### 方法

#### stack对象的存放

```cpp
stack.push(elem);  //往栈头添加元素
stack.pop();  //从栈头移除第一个元素 
```

#### stack对象的拷贝构造与赋值

```cpp
stack(const stack &stk); / /拷贝构造函数
stack& operator=(const stack &stk);  //重载等号操作符
```

such as

```cpp 
stack<int> stkIntA, stkIntC;
stack<int> stkIntB(stkIntA);
stack<int> stkIntD;
stkIntD = stkIntC;
```

#### stack对象的数据读取

```cpp
stack.top();  //返回最后一个压入栈元素
```

#### stack对象的大小

```cpp
stack.empty();  //判断堆栈是否为空
stack.size();  //返回堆栈的大小
```

### 经典例题

[表达式括号匹配](https://www.luogu.com.cn/problem/P1739)

[栈](https://www.luogu.com.cn/problem/P1044)

[双栈排序](https://www.luogu.com.cn/problem/P1155)

## 队列(queue)

这个我就不用什么奇怪的东西来形容了，这个就是有入口有出口，按顺序排队进去排队出来

~~（干正事吧，芭芭脱丝）~~

### 定义

```cpp
#include<queue>
using namespace std;
```

同样也有存各种数据类型的队列

```cpp
queue <int> queueInt;  //一个存放int的queue容器。
queue <float> queueFloat;  //一个存放float的queue容器。
queue <string> queueString;  //一个存放string的queue容器。 
```

### 方法

#### queue对象的存取

```cpp
queue.push(X);  //在队尾压入新元素 ，X为要压入的元素
queue.pop();  //删除队列首元素但不返回其值
```

#### queue对象的数据读取

```cpp
queue.front();  // 返回队首元素的值，但不删除该元素
queue.back();  //返回队列尾元素的值，但不删除该元素  
```

#### queue对象的大小

```cpp
queue.empty();  //判断堆栈是否为空
queue.size();  //返回堆栈的大小
```

### 经典例题

广度优先算法(bfs)就是一个使用队列的例子

其他的例题嘛。。。说实在我好像没写过多少，看到再列出来吧

--------

> 这里又开始咕了

· 优先队列

--------
