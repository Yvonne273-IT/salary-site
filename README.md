# 藥局薪資管理系統

正職／兼職薪資試算網站，取代原本每月複製一份 Excel 的流程。以 React + Vite 打造，可免費部署在 GitHub Pages 上。

## 功能

- **員工資料**：正職員工的固定薪資結構（本薪、津貼、投保金額等）
- **正職薪資計算**：每月只需輸入異動數字（獎金、加班分鐘、車馬費、特休天數），其餘自動帶入計算
- **兼職資料 / 兼職時薪計算**：兼職人員時薪設定 + 每月工時換算薪資
- **勞健保級距**：可自行維護的投保級距對照表
- **薪資單**：可直接列印的個人薪資單
- **匯出／匯入備份**：右上角可將資料匯出成 JSON 檔案備份，或匯入還原

資料儲存在**瀏覽器的 localStorage**，也就是只存在你使用的這台電腦、這個瀏覽器裡（不會上傳到任何伺服器）。定期用「匯出備份」存一份 JSON 檔案，避免清除瀏覽器資料時遺失。

---

## 步驟一：把程式碼放上 GitHub

1. 到 [github.com/new](https://github.com/new) 建立一個新的 repository（例如命名為 `pharmacy-salary-app`）。**不要**勾選「Add a README file」，保持空的 repo。
2. 在你的電腦上，把這個資料夾裡所有檔案放進一個資料夾，然後在該資料夾內執行：

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/pharmacy-salary-app.git
   git push -u origin main
   ```

   （把 `<你的帳號>` 換成你的 GitHub 帳號名稱；如果 repo 名稱不是 `pharmacy-salary-app`，記得同步修改 `vite.config.js` 裡的 `REPO_NAME`，見下方說明。）

## 步驟二：開啟 GitHub Pages

1. 到你剛建立的 repo 頁面，點選 **Settings → Pages**。
2. 在「Build and deployment」的 **Source** 選單，選擇 **GitHub Actions**。
3. 回到 **Actions** 分頁，應該會看到剛剛 push 觸發的 workflow（`Deploy to GitHub Pages`）正在執行或已完成。第一次需要幾分鐘。
4. 完成後，回到 **Settings → Pages** 頁面上方會顯示網站網址，格式通常是：

   ```
   https://<你的帳號>.github.io/pharmacy-salary-app/
   ```

之後每次你把新的修改 push 到 `main` 分支，網站都會自動重新部署（已內建 `.github/workflows/deploy.yml`）。

### 如果 repo 名稱跟 `pharmacy-salary-app` 不一樣

打開 `vite.config.js`，把這一行的值改成你實際的 repo 名稱：

```js
const REPO_NAME = "pharmacy-salary-app"; // 改成你的 repo 名稱
```

如果你是部署到 `<你的帳號>.github.io`（也就是「使用者主頁」型的 repo，repo 名稱本身就是 `<你的帳號>.github.io`），則把 `base` 改回 `"/"`：

```js
export default defineConfig({
  plugins: [react()],
  base: "/",
});
```

---

## 本機開發（選用）

如果你想在自己電腦上先預覽、修改：

```bash
npm install
npm run dev
```

會啟動一個本機網址（通常是 `http://localhost:5173`），修改程式碼會即時更新畫面。

打包成正式版（GitHub Actions 會自動做這件事，通常不需要手動執行）：

```bash
npm run build
npm run preview   # 預覽打包後的結果
```

---

## 注意事項：勞健保級距表

原始 Excel 檔案裡的「勞健保級距」只有一筆資料（投保薪資 1500）。系統已經把這筆帶入，但其餘級距請你自行到「勞健保級距」頁籤，依勞保局／衛福部最新公告的投保薪資分級表輸入，否則員工的「勞健保自付額」欄位會顯示找不到對應級距的提醒。

## 年度特休結算的計算邏輯

比照原始範本：「年度特休結算」金額會顯示在薪資單的加項欄位中，但**不計入**「本月薪資／現金」的加總（原始 Excel 公式本身就沒有把這欄算進去）。如果這在原始檔案中其實是個誤植、而非刻意設計，之後可以再調整 `src/App.jsx` 裡 `computePayrollRow` 函式的 `earnings` 計算方式即可。
