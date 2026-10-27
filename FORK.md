# 本仓库是什么

这是 [`g-yixuan/dsh-sidenote`](https://github.com/g-yixuan/dsh-sidenote) 的一个**本地分支（fork）**，基线版本 **v0.7.5**（上游 tag `0e3872fe`，2026-10-26）。

- 上游作者：**gyixuan**；许可：**MIT**（`LICENSE` 原样保留，未做任何修改）。
- 本 fork 只改了「批注编号」与「注释编辑器关闭语义」两处行为，其余代码与上游一致。
- 版本号 `0.7.6-fork.1` 表示「上游 0.7.5 + 本 fork 第 1 版补丁」，避免与上游发布版本混淆。

如果你只是想用上游原版，请直接装 npm 上的 `dsh-sidenote`；想让批注按轮编号、空注解读空白处自动取消，再用本仓库。

---

## 本 fork 的两处行为改动

### 1. 批注编号按轮重置（不再全局递增）

上游：每条批注的编号在会话内单调递增，发出去以后仍然续号；删掉中间一条，后面的号不回填。

本 fork：**编号只对「当前这一轮还没发出去的批注」计数**。

- 当前批次内新增 → 接着排（1、2、3…）；
- 删掉当前批次里的一条 → 剩下的按实际条数重排成连续的 1..n（1、2、3、4 删第 2 条 → 1、2、3；再删第 1 条 → 1、2）；
- 当前批次发送出去之后，这些号**冻结**，不再参与后续重排（避免和已发出消息里的角标对不上）；
- 下一轮新批注从 **1** 重新开始。

涉及：`src/client/annotations/model.ts`（`renumberActive` / `countActiveIn`，`add` / `remove` / `markSent` / 水合迁移）。

### 2. 新建注释时点空白处：空注解 = 取消

上游：新建注释状态下，点编辑器外面一律「确认」，即使一个字都没写，也会留一条空注解。

本 fork：**新建态点外部时，如果注解内容为空，视为放弃这次引用（整条移除）；只有写了内容才按原行为保存**。

- ✓ 按钮与 Enter 仍然是「发送 / 保存」，语义不变；
- Esc 仍然是显式放弃；
- 重开已有注解时点外部，仍是取消编辑、不删注解。

涉及：`src/client/annotate/overlay.tsx`（`AnnotationEditor` 的 `onMouseDown` 外部点击分支）。

---

## 与上游的完整差异

| 文件 | 改动 |
| --- | --- |
| `src/client/annotations/model.ts` | 编号按轮重置 + 删除后重排 + 水合时迁移旧数据 |
| `src/client/annotate/overlay.tsx` | 新建态空注解点外部 = 取消 |
| `tests/annotate.spec.ts` | 两条用例改为断言新语义（删除后重排、刷新后新一轮从 1 起） |
| `tests/annotate-editor.spec.tsx` | 一条用例改为断言「空注解点外部 = 取消」 |
| `package.json` | `version` 改为 `0.7.6-fork.1`；`repository` / `homepage` / `bugs` 指向本仓库；新增 `forkedFrom` |
| `.gitignore` | 移除 `lib/`，让预构建产物入库（见下） |
| `.github/workflows/` | **未随本 fork 发布**：推送所用 token 没有 `workflow` 权限，GitHub 拒绝创建/更新 Actions 工作流文件。其余 `.github/` 模板（PR、ISSUE）照常保留。需要 CI 时可给 token 补 `workflow` scope 后从上游取回这两个文件，或直接在网页上新建。 |

`lib/` 与 `lib/types/` 是**由上述 `src/` 构建出来的产物**，一并入库，这样可以直接从本仓库安装，不需要在本地跑构建链：

```bash
dsh plugin add git+https://github.com/TaoCultivator/dsh-sidenote.git
```

（上游把 `lib/` 排除在仓库外、只通过 npm 发布；本 fork 选择入库，是从仓库直装的代价取舍。）

## 构建与测试

```bash
pnpm install --frozen-lockfile
pnpm typecheck   # tsc --noEmit
pnpm build       # 产出 lib/ 与 lib/types/
pnpm test        # vitest
```

- `pnpm typecheck`、`pnpm build` 在本机（Node 24.22.0 + pnpm 11.26.0 / 11.28.5）通过。
- `pnpm test`：**307 通过 / 17 失败**。这 17 项在**未打补丁的上游 v0.7.5 上同样失败**（已用同一份锁文件做过基线对比），原因集中在两处与本 fork 无关的环境差异：
  1. 断言里写死了英文界面文案（`I annotated 2 passage(s)…`、`Run command /goal x`、`retry`），本机 locale 为中文，取到的是中文文案；
  2. `tests/compatibility-window.spec.ts` 与 `tests/sidechat.spec.ts` 的若干用例依赖上游 CI 环境的时序/命名前提。
- 打补丁前新增的 3 条失败已随测试用例更新而消除，补丁前后失败数同为 17。

## 许可与致谢

- `LICENSE` 为上游 **MIT** 原文，版权归原作者 gyixuan，未改动。
- 本 fork 的所有改动同样以 MIT 发布。
- 上游地址：<https://github.com/g-yixuan/dsh-sidenote>。上游若继续演进，本 fork 不承诺跟随。
