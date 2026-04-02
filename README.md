# ⚾ 野球のびノート — セットアップ手順書

初心者向けに、**ゼロから動かすまでの全手順**を説明します。

---

## 📁 ファイル構成

```
yakyuu-nobi-note/
├── index.html              ← HTMLの入口
├── package.json            ← 使うライブラリの設定
├── vite.config.js          ← ビルド設定（GitHub Pagesのパス設定あり）
├── firestore.rules         ← Firebaseのセキュリティルール
├── README.md               ← この手順書
└── src/
    ├── main.jsx            ← アプリの起動ファイル
    ├── App.jsx             ← 画面ルーティング
    ├── firebase.js         ← ★Firebaseの設定（ここを書き換える）
    ├── index.css           ← 全体のデザイン
    ├── contexts/
    │   └── AuthContext.jsx ← ログイン状態の管理
    ├── components/
    │   └── Layout.jsx      ← ヘッダー＋ナビゲーション
    └── pages/
        ├── Login.jsx       ← ログイン・新規登録画面
        ├── Home.jsx        ← ホーム画面
        ├── DailyRecord.jsx ← 今日のふりかえり入力
        ├── TrainingMenu.jsx← 練習メニュー記録
        ├── MyStats.jsx     ← 成長グラフ・統計
        ├── TeamRanking.jsx ← チームランキング
        ├── ParentView.jsx  ← 親用みまもり画面
        └── Settings.jsx    ← 設定画面
```

---

## 🔥 STEP 1: Firebase のセットアップ

### 1-1. Firebaseプロジェクトを作る

1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: `yakyuu-nobi-note`）
4. Googleアナリティクスは「有効にする」でも「しない」でもOK
5. 「プロジェクトを作成」をクリック

### 1-2. Authentication（ログイン機能）を有効にする

1. 左メニューの「Authentication」をクリック
2. 「始める」をクリック
3. 「Sign-in method」タブを開く
4. 「メール/パスワード」をクリック → 「有効にする」をONにして保存

### 1-3. Firestore Database を作る

1. 左メニューの「Firestore Database」をクリック
2. 「データベースの作成」をクリック
3. 「**本番環境モード**」を選択 → 次へ
4. リージョンは `asia-northeast1`（東京）を選択 → 有効にする

### 1-4. セキュリティルールを設定する

1. Firestore Database の「ルール」タブを開く
2. `firestore.rules` ファイルの中身を**全部コピー**して貼り付ける
3. 「公開」ボタンをクリック

### 1-5. アプリの設定情報を取得する

1. 左上の歯車アイコン「プロジェクトの設定」をクリック
2. 「マイアプリ」セクションまでスクロール
3. `</>` (ウェブ) アイコンをクリック
4. アプリのニックネームを入力（例: `nobi-note-web`）
5. 「アプリを登録」をクリック
6. 表示される `firebaseConfig` の中身をコピーする

```javascript
// こういう形のものが表示されます
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "yakyuu-nobi-note.firebaseapp.com",
  projectId: "yakyuu-nobi-note",
  storageBucket: "yakyuu-nobi-note.appspot.com",
  messagingSenderId: "12345...",
  appId: "1:12345...:web:abc..."
};
```

### 1-6. src/firebase.js に貼り付ける

`src/firebase.js` を開いて、`YOUR_API_KEY` などを上記の値に置き換えてください。

---

## 💻 STEP 2: パソコンで動かす（ローカル確認）

### 2-1. Node.js をインストール

https://nodejs.org/ からLTS版をダウンロードしてインストール。

### 2-2. ターミナルでプロジェクトフォルダに移動

```bash
cd C:\Users\deg21\OneDrive\Desktop\kimini_english\baseboll\yakyuu-nobi-note
```

### 2-3. ライブラリをインストール

```bash
npm install
```

（少し時間がかかります）

### 2-4. 開発サーバーを起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173/yakyuu-nobi-note/` を開くと確認できます。

---

## 🌐 STEP 3: GitHub Pages に公開する

### 3-1. GitHubにリポジトリを作る

1. https://github.com/ にアクセス（アカウントがなければ作成）
2. 右上の「＋」→「New repository」をクリック
3. Repository name: `yakyuu-nobi-note`
4. Public を選択（GitHub Pages は無料プランでPublicのみ）
5. 「Create repository」をクリック

### 3-2. vite.config.js の設定確認

`vite.config.js` の `REPO_NAME` が自分のリポジトリ名と一致しているか確認。

```javascript
const REPO_NAME = '/yakyuu-nobi-note/'  // ← GitHubのリポジトリ名と合わせる
```

### 3-3. main.jsx の basename 確認

`src/main.jsx` の `basename` も同様に確認。

```jsx
<BrowserRouter basename="/yakyuu-nobi-note">
```

### 3-4. Gitの初期設定とプッシュ

```bash
# プロジェクトフォルダ内で実行
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/あなたのGitHub名/yakyuu-nobi-note.git
git push -u origin main
```

### 3-5. GitHub Pages にデプロイ

```bash
npm run deploy
```

これで自動的にビルドして `gh-pages` ブランチにアップされます。

### 3-6. GitHub の設定

1. GitHubのリポジトリページを開く
2. 「Settings」タブ → 左メニュー「Pages」
3. Source: `Deploy from a branch`
4. Branch: `gh-pages` / `/ (root)` を選択 → Save

数分後に `https://あなたのGitHub名.github.io/yakyuu-nobi-note/` で公開されます！

---

## 👥 STEP 4: チームメンバーが使えるようにする

### 子どものアカウント登録手順

1. アプリのURLを開く
2. 「新規登録」タブ → 「⚾ 子ども」を選択
3. ニックネーム・メール・パスワードを入力して登録

### 親のアカウント登録手順

1. アプリのURLを開く
2. 「新規登録」タブ → 「👨‍👩‍👦 保護者」を選択
3. 名前・メール・パスワードを入力して登録
4. 設定画面で子どものユーザーIDを入力
   （子どもの設定画面で確認できる）

---

## 🔧 チームコードの変更方法

全員が同じチームランキングに入るよう、`src/pages/Login.jsx` の先頭にある

```javascript
const TEAM_CODE = 'team001'
```

を自分のチーム専用の文字列に変更してください（例: `tigers2024`）

---

## 📈 今後の拡張予定（フェーズ2）

- [ ] 連続記録バッジ表示（7日・14日・30日）
- [ ] 「ナイス！」を仲間に送る機能
- [ ] 親が子どもにコメントを送る機能
- [ ] コーチ閲覧ロール追加
- [ ] 週間目標の設定機能
- [ ] グラフの更なる充実（週別比較など）

---

## ❓ よくある質問

**Q: ログインできない**
→ Firebase Console で Authentication が有効になっているか確認。`firebase.js` の設定値が正しいか確認。

**Q: データが保存されない**
→ Firestore のセキュリティルールを確認。ルールが正しく設定されているか確認。

**Q: GitHub Pages で真っ白になる**
→ `vite.config.js` と `main.jsx` の basename がリポジトリ名と一致しているか確認。

**Q: チームのランキングに仲間が出ない**
→ 全員が同じ `TEAM_CODE` で登録しているか確認。
