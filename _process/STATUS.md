# STATUS — gta6-01: Make GTA 6

## 任务
为 make.fun 的 gta6-01 赏金构建一个 GTA-6 风格开放世界犯罪游戏（HTML5 静态游戏），并以 @banewong 身份提交。

## 已确认的事实
1. **账户**：@banewong 已登录，API key 有效至 2026-12-24，钱包 `GLgZvr7bwgfVykdqy2VXR3crBkN52ADaQwCxmnxKfs7u`
2. **GitHub 仓库**：`https://github.com/BaneWong/gta6-01` 已创建，starter 文件已推送
3. **Node.js**：v24.21.0，满足 22.18+ 要求
4. **配额**：gta6-01 剩 5/天，10 总，40 硬限
5. **截止时间**：2026-11-24T23:00 CST（约 2.3 小时）
6. **DSH 是记录器白名单中的**（skill.md 明确列出 DeepSeek Harness）

## 已解决
- ✅ GitHub 仓库创建（BaneWong/gta6-01）
- ✅ Starter kit 文件放入仓库（game/, main.ts, vendor/makefun-game.ts, etc.）
- ✅ .makefun/owner.json 设置钱包标识
- ✅ 初始 git commit + push

## 未解决 / 卡在哪
1. **录制机制**：`makefun record` 扫描本机数百个会话文件需 5+ 分钟，且要求会话在录制开始后新建。当前 DSH 会话在录制之前开始，无法使用。需要在新 DSH 会话中构建游戏，让录制捕获。
2. **构建 GTA-6 游戏**：RULES.txt 要求——城市探索（步行/驾车）、交通/行人、车辆盗窃、通缉等级/警察响应、任务/剧情、战斗、HUD/小地图、开始界面、存档系统、截图（3-4 张）。作为静态 HTML5 游戏实现，这是庞大工程。
3. **截图生成**：需要在浏览器中打开本地服务器启动的游戏并截图。Playwright MCP 可用但未配置。
4. **提交流程**：需要 bundle → 验证 → 提交 → 过 bountygate 门禁。

## 下一步
1. 在 keep-alive 录制进程中构建游戏代码（新会话方式）
2. 或：用 headless 模式运行录制 → 构建 → 停止
3. 构建完成后 `node serve.ts` 启动 → Playwright 截图
4. 更新 main.ts 输出到 /output → bundle → 提交
5. 验证：`bountygate.sh gta6-01-repo --session <id>`
