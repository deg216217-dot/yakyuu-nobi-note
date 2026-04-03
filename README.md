# ⚾ 野球のびノート v2 — セットアップ手順書

## 📁 フォルダ構成

```
yakyuu-nobi-note/
├── index.html                 ← HTMLの入口
├── package.json               ← ライブラリ管理
├── vite.config.js             ← ビルド設定
├── firestore.rules            ← Firebaseセキュリティルール
├── .gitignore
├── README.md                  ← この手順書
└── src/
    ├── main.jsx               ← アプリ起動
    ├── App.jsx                ← 画面ルーティング
    ├── firebase.js            ← ★ Firebase設定（書き換え済み）
    ├── index.css              ← 全体デザイン
    ├── utils/
    │   ├── dateUtils.js       ← 日付の便利関数
    │   └── localStore.js      ← おためしモード用 localStorage操作
    ├── contexts/
    │   └── AuthContext.jsx    ← 認証＆おためしモード管理
    ├── components/
    │   ├── Layout.jsx         ← ヘッダー＋ボトムナビ
    │   └── SuccessOverlay.jsx ← 達成演出
    └── pages/
        ├── Welcome.jsx        ← 初回画面（おためし/ログイン/登録）
        ├── Home.jsx           ← ホーム画面
        ├── DailyRecord.jsx    ← 今日のふりかえり入力
        ├── TrainingMenu.jsx   ← 練習メニュー記録
        ├── MyStats.jsx        ← 自分の成長グラフ
        ├── TeamRanking.jsx    ← チームランキング（公開要約のみ）
        ├── ParentView.jsx     ← 親用みまもり画面
        └── Settings.jsx       ← 設定（登録導線あり）
```

---

## 🧭 モード設計

### おためしモード（ログイン不要）
- 初回画面で「おためしスタート」を押すだけで使える
- データは**この端末の localStorage にだけ**保存される
- チームランキング、親閲覧、複数端末同期は使えない
- 別の端末には引き継がれない

### 本登録モード（Firebase）
- メールアドレスで登録
- データはクラウド保存される
- チームランキングに参加できる
- 親が閲覧できる
- 別端末でもログインすれば使える
- **おためし中のデータは登録時に自動で引き継がれる**

---

## 📊 Firestoreコレクション設計

| コレクション | 誰が読める | 内容 |
|---|---|---|
| `users` | 本人＋チームメンバー | ニックネーム、役割、チームコード |
| `privateRecords` | **本人＋親だけ** | 100点プレー、モヤっと、詳細日記 |
| `publicSummaries` | **チーム全員** | 練習時間、気分、ひとこと（要約のみ） |
| `trainingMenus` | チーム全員 | 練習メニュー（TOP3集計用） |
| `parentChildLinks` | 親と子本人 | 親子の紐付け |

**重要**: `privateRecords`には日記の詳細が入っており、他の子どもは絶対に読めません。

---

## 🔥 STEP 1: Firebaseセットアップ

### 1-1. プロジェクト作成
1. https://console.firebase.google.com/ を開く
2. 「プロジェクトを追加」→ 名前を入力 → 作成

### 1-2. Authentication を有効にする
1. 左メニュー「Authentication」→「始める」
2. 「Sign-in method」→「メール/パスワード」→ 有効にする → 保存

### 1-3. Firestore Database を作る
1. 左メニュー「Firestore Database」→「データベースの作成」
2. 「本番環境モード」→ リージョン `asia-northeast1`（東京）→ 有効にする

### 1-4. セキュリティルールを設定
1. Firestore の「ルール」タブを開く
2. `firestore.rules` の中身を全部コピーして貼り付ける
3. 「公開」をクリック

### 1-5. Firestoreの複合インデックスを作成
アプリを使っていると、Firebaseコンソールのエラーにインデックス作成リンクが表示されます。
そのリンクをクリックすると自動で作成されます。

主に必要なインデックス:
- `privateRecords`: `uid` + `date` (昇順)
- `publicSummaries`: `uid` + `date` (降順)
- `publicSummaries`: `teamCode` + `date`

### 1-6. firebase.js の設定
すでに設定済みです。変更が必要な場合は `src/firebase.js` を編集してください。

---

## 💻 STEP 2: ローカルで動かす

```bash
cd C:\Users\deg21\OneDrive\Desktop\kimini_english\baseboll\yakyuu-nobi-note
npm install
npm run dev
```

ブラウザで `http://localhost:5173/yakyuu-nobi-note/` を開く。

初回は「おためしスタート」を押すとすぐに使えます！

---

## 🌐 STEP 3: GitHub Pagesに公開

### 3-1. GitHubリポジトリを作る
1. https://github.com/ → 「New repository」
2. 名前: `yakyuu-nobi-note`、Public、作成

### 3-2. プッシュ
```bash
cd C:\Users\deg21\OneDrive\Desktop\kimini_english\baseboll\yakyuu-nobi-note
git init
git add .
git commit -m "初回コミット"
git branch -M main
git remote add origin https://github.com/あなたのGitHub名/yakyuu-nobi-note.git
git push -u origin main
```

### 3-3. デプロイ
```bash
npm run deploy
```

### 3-4. GitHub設定
Settings → Pages → Branch: `gh-pages` / `/ (root)` → Save

数分後に `https://あなたのGitHub名.github.io/yakyuu-nobi-note/` で公開！

---

## 👥 使い方

### 子どもの場合
1. アプリを開く → 「おためしスタート」→ ニックネーム入力
2. 毎日「きろく」タブで振り返りを書く
3. 「練習メニュー」で練習時間を記録
4. 続けたくなったら設定画面から「アカウント登録」

### 保護者の場合
1. アプリを開く → 「新規登録」→「保護者」を選択
2. 設定画面で子どものユーザーIDを入力
3. 「みまもり」タブで子どもの記録を確認

---

## 🔒 プライバシー設計のまとめ

| 情報 | 本人 | 親 | チーム |
|---|---|---|---|
| 100点プレー本文 | ✅ | ✅ | ❌ |
| モヤっと本文 | ✅ | ✅ | ❌ |
| チームメイトのナイスプレー | ✅ | ✅ | ❌ |
| 練習時間（合計） | ✅ | ✅ | ✅ |
| 今日のひとこと | ✅ | ✅ | ✅ |
| 次の目標 | ✅ | ✅ | ✅ |
| 気分 | ✅ | ✅ | ✅ |
| 連続記録日数 | ✅ | ✅ | ✅ |
| 練習メニューTOP3 | ✅ | ✅ | ✅ |

---

## 📈 今後の拡張（フェーズ2）

- [ ] 連続記録バッジ（7日・14日・30日）
- [ ] 「ナイス！」を仲間に送る機能
- [ ] 週間目標の設定
- [ ] グラフの充実（週別比較など）
- [ ] コーチ閲覧ロール追加
- [ ] PWA対応（ホーム画面に追加）
