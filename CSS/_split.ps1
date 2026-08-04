# CSS 拆分脚本：按行范围将 style.css 物理拆分为多个模块文件
# 仅写入 12 个模块文件，不触碰 style.css（入口文件稍后单独生成）
$ErrorActionPreference = 'Stop'
$src = "c:\Users\18237\Desktop\研枢\github上传\CSS\style.css"
$dir = "c:\Users\18237\Desktop\研枢\github上传\CSS"
# 显式以 UTF-8 读取源文件，避免系统默认 GBK 编码导致中文乱码
$lines = [System.IO.File]::ReadAllLines($src, [System.Text.Encoding]::UTF8)
Write-Host "源文件总行数: $($lines.Count)"

# 每个文件：头部注释 + 行范围对（1-indexed，闭区间）
$map = [ordered]@{
  'variables.css' = @{
    Header = @(
      '/**',
      ' * variables.css — CSS 自定义属性（设计令牌）',
      ' * 研枢全局设计令牌：品牌色、背景、文字色、阴影、圆角、尺寸、字体栈、过渡。',
      ' * 该文件必须在所有其他样式之前加载。',
      ' */'
    )
    Ranges = @(8,50)
  }
  'base.css' = @{
    Header = @(
      '/**',
      ' * base.css — 基础重置与全局排版',
      ' * 全局盒模型重置、body 主体、交互控件统一行为、键盘焦点环、',
      ' * 选中文字高亮、滚动条、页面切换系统与通用工具类。',
      ' */'
    )
    Ranges = @(52,77, 79,106, 157,186, 595,642)
  }
  'animations.css' = @{
    Header = @(
      '/**',
      ' * animations.css — 动画定义',
      ' * 所有 @keyframes 关键帧定义，以及按钮按下缩放等交互动画反馈。',
      ' */'
    )
    Ranges = @(110,115, 2800,2806, 6420,6484)
  }
  'components.css' = @{
    Header = @(
      '/**',
      ' * components.css — 通用组件样式',
      ' * 骨架屏、按钮一致性、CCF/匹配度徽章、收藏弹窗、通知面板、',
      ' * 快捷键面板、命令面板、收藏页、通知页、统计弹窗、版本演进面板、V3 原型等通用 UI。',
      ' */'
    )
    Ranges = @(108,109, 117,155, 644,661, 1179,1247, 4355,4514, 4517,4698, 4700,4819, 4821,4949, 4952,5054, 5055,5145, 5265,5323, 5324,5518, 5553,5634)
  }
  'sidebar.css' = @{
    Header = @(
      '/**',
      ' * sidebar.css — 侧边栏导航',
      ' * 侧边栏容器（毛玻璃）、Logo、折叠切换、导航项、Tooltip、',
      ' * 底部用户信息、深色切换按钮、收藏角标，以及主内容区偏移。',
      ' */'
    )
    Ranges = @(188,593)
  }
  'search.css' = @{
    Header = @(
      '/**',
      ' * search.css — 搜索页样式',
      ' * Hero 区域、搜索框、统计卡片、搜索历史面板、筛选标签、',
      ' * 论文卡片网格、论文内容、操作按钮、加载更多、每日推荐。',
      ' */'
    )
    Ranges = @(664,901, 953,1031, 1033,1094, 1097,1178, 1248,1543)
  }
  'ai-chat.css' = @{
    Header = @(
      '/**',
      ' * ai-chat.css — AI 助手页样式',
      ' * V1/V2/V3 布局、对话列表、消息气泡、输入区、编辑器、',
      ' * 话题卡片、学术 Markdown 渲染、模式切换、速读双语、加载点。',
      ' */'
    )
    Ranges = @(1595,2799, 2807,2819)
  }
  'submission.css' = @{
    Header = @(
      '/**',
      ' * submission.css — 投稿分析页样式',
      ' * V1/V2 布局、期刊卡片、投稿 AI 对话、趋势图表、引用图谱、',
      ' * 词云、详情趋势、筛选器、日历弹窗、期刊详情弹窗。',
      ' */'
    )
    Ranges = @(2821,3416, 5147,5264, 6407,6412)
  }
  'library.css' = @{
    Header = @(
      '/**',
      ' * library.css — 文献库样式',
      ' * 主从布局、分区、文件夹项、标签云、统计、工具栏、',
      ' * 文献列表项、阅读状态、进度、批量操作栏。',
      ' */'
    )
    Ranges = @(3418,3793)
  }
  'reading.css' = @{
    Header = @(
      '/**',
      ' * reading.css — 阅读浮层样式',
      ' * 阅读全屏覆盖层、顶栏、PDF 阅读区、浮动菜单、进度条、',
      ' * 阅读 AI 面板、公式解读弹窗、相似论文卡片、知识图谱 SVG。',
      ' */'
    )
    Ranges = @(1544,1593, 3796,4354, 5519,5552)
  }
  'dark-mode.css' = @{
    Header = @(
      '/**',
      ' * dark-mode.css — 深色模式覆盖样式',
      ' * [data-theme="dark"] 下的设计令牌覆盖及各模块深色样式覆盖。',
      ' */'
    )
    Ranges = @(903,925, 5637,6405, 6414,6417)
  }
  'responsive.css' = @{
    Header = @(
      '/**',
      ' * responsive.css — 响应式媒体查询',
      ' * 所有 @media 规则：1200px / 900px / 768px / 600px 断点适配。',
      ' */'
    )
    Ranges = @(927,952, 6487,6810)
  }
}

$utf8noBom = New-Object System.Text.UTF8Encoding($false)
$totalOut = 0
foreach ($name in $map.Keys) {
  $info = $map[$name]
  $out = New-Object System.Collections.Generic.List[string]
  foreach ($l in $info.Header) { $out.Add($l) }
  $out.Add('')
  $ranges = $info.Ranges
  for ($i = 0; $i -lt $ranges.Count; $i += 2) {
    $start = $ranges[$i]
    $end = $ranges[$i + 1]
    for ($n = $start; $n -le $end; $n++) {
      $out.Add($lines[$n - 1])
    }
  }
  $content = ($out -join "`r`n") + "`r`n"
  [System.IO.File]::WriteAllText("$dir\$name", $content, $utf8noBom)
  $totalOut += $out.Count
  Write-Host ("{0,-20} 行数={1}" -f $name, $out.Count)
}
Write-Host "所有模块文件总行数(含头部注释): $totalOut"
