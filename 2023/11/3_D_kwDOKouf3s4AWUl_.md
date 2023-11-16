---
author: onntztzf
category: 🙌 Show and tell
labels: "-"
discussion: https://github.com/onntztzf/test_action/discussions/3
updatedAt: "2023-11-15T21:07:55+08:00"
---

# Excel 教程：如何使用公式取两列的交集

在工作中，我们经常需要使用 `Excel` 做数据处理，如比较、筛选、清洗等。**找出两个列之间的交集**这个操作可以在许多情况下派上用场。本文将向您介绍如何使用公式来找出两列的交集，我们使用的公式如下：

```excel
=IF(ISNUMBER(MATCH(A1,$B:$B,0)),A1,"")
```

## 公式解读

### IF

`IF` 函数是 `Excel` 中的条件函数，用于在满足特定条件时执行一个操作，否则执行另一个操作。公式的基本结构如下：

```excel
=IF(条件, 条件为真时的结果, 条件为假时的结果)
```

在上面的公式中，条件是通过 `MATCH` 函数和 `ISNUMBER` 函数的组合来确定的，我们将在后面详细讨论。

### ISNUMBER

`ISNUMBER` 函数是 `Excel` 中的判断函数，用于检查给定值是否为数字的函数，如果是数字则返回 `TRUE`，否则返回 `FALSE`。公式的基本结构如下：

```excel
=ISNUMBER(值)
```

在上面的公式中，它的作用是验证 `MATCH` 函数的结果是否是一个数字。

### MATCH

`MATCH` 函数是 `Excel` 中的匹配函数，用于在一个范围内查找某个值，并返回该值在范围中的相应位置，如果找到匹配项，它将返回该项的位置，否则返回错误值 `#N/A`。。公式的基本结构如下：

```excel
=MATCH(要查找的值, 查找范围, [匹配类型])
```

在上面的公式中，`MATCH` 函数的任务是查找 `A1` 单元格的值是否存在于 `B` 列中。

## 公式的工作原理

现在，让我们将这些函数组合起来，看看这个公式是如何工作的：

```excel
=IF(ISNUMBER(MATCH(A1,$B:$B,0)),A1,"")
```

1. 首先，`MATCH(A1,$B:$B,0)` 查找 `A1` 单元格的值是否在 `B` 列中找到匹配项。如果找到匹配项，它将返回匹配项的位置，否则返回#N/A。
2. 接下来，`ISNUMBER(MATCH(A1,$B:$B,0))` 检查 `MATCH` 函数的结果是否为数字。如果找到匹配项，这个表达式将返回 `TRUE`，否则返回 `FALSE`。
3. 最后，`IF(ISNUMBER(MATCH(A1,$B:$B,0)),A1,"")` 利用条件函数。如果 `ISNUMBER` 函数返回 `TRUE`，则返回 `A1` 单元格的值（即 `A1` 单元格的内容），否则返回一个空字符串 ""。

## 如何使用这个公式

现在，让我们看看如何在实际工作中使用这个公式。

假设您有一个 `Excel` 工作表，其中包含两列数据：列 `A` 包含要检查匹配的值，列 `B` 包含目标范围：

| A 列 | B 列 | C 列 |
| ---- | ---- | ---- |
| 1    | 2    |
| 2    | 3    |
| 3    | 4    |
| 4    | 5    |
| 5    | 6    |

1. 在 `C1` 单元格中输入公式 `=IF(ISNUMBER(MATCH(A1,$B:$B,0)),A1,"")`。
2. 在 `C1` 中输入公式后，将鼠标指针悬停在 `C1` 单元格的右下角，直到光标变为一个黑色十字。然后，点击并拖动以填充下面的单元格，直到您处理完整个数据集。

完成上述步骤后，`C` 列中将显示两列之间的交集。`C` 列中的每个单元格都包含在 `A` 列和 `B` 列中都存在的值。即：

| A 列 | B 列 | C 列 |
| ---- | ---- | ---- |
| 1    | 2    |
| 2    | 3    | 2    |
| 3    | 4    | 3    |
| 4    | 5    | 4    |
| 5    | 6    | 5    |

这使您能够轻松识别共同元素，无需手动比较每个单元格。

## 总结

在数据处理的工作中，`Excel` 是不可或缺的工具。各种函数的组合提供了一种强大的方式，可以帮助您有效地处理和筛选数据。通过了解和利用这些函数，您可以更好地利用 `Excel` 来处理各种数据分析任务，以提高数据处理的效率和准确性。希望本文对您有所帮助，如果您有任何关于这个公式或 `Excel` 其他方面的问题，请随时留言！

######

如果觉得本篇文章不错，麻烦给个**点赞👍、收藏🌟、分享👊、在看👀**四连！

![干货输出机](https://file.zhangpeng.site/wechat/qrcode.jpg)