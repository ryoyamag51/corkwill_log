/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy · CorkWill", alternates: { canonical: "/privacy" } };
export default function Privacy() {
  return <main className="landing-shell" style={{ maxWidth: 760, padding: "48px 24px", lineHeight: 1.8 }}>
    <a href="/">← CorkWill</a><h1>Privacy / プライバシー</h1>
    <p>CorkWill Log stores your email address, account preferences, scoring rules, and daily records to provide your personal log and sync it across devices. Your records are available only to your signed-in account; they are not published on the homepage.</p>
    <p>Google sign-in requests your basic identity and email address. It does not request access to your Gmail messages or contacts. An essential, secure session cookie keeps you signed in. Local browser storage holds your preferences and account-specific drafts.</p>
    <p>The application and database run on Cloudflare. When enabled, email sign-in codes are delivered through Resend. These services process the information needed to run the service. Google handles the Google sign-in flow.</p>
    <p>You can export your records and delete your account in Log → Settings → Data. Deleting your account removes its active database records and sessions. Copies previously exported or saved on a device remain on that device. Cloudflare may retain recovery backups according to its retention settings.</p>
    <h2>日本語</h2><p>CorkWill Log は、メールアドレス、設定、採点ルール、日々の記録を保存し、個人の記録と端末間の同期を提供します。記録はログインした本人のアカウントから利用でき、トップページには公開されません。</p>
    <p>Google ログインで利用するのは基本的な本人情報とメールアドレスです。Gmail のメール本文や連絡先へのアクセスは要求しません。ログイン状態の維持には Cookie を、下書きの保存にはアカウントごとに分けたブラウザー内ストレージを使用します。</p>
    <p>アプリとデータベースは Cloudflare 上で動作します。メール認証を有効にした場合、認証コードの配信には Resend を使用します。設定の「データ」から記録のエクスポートとアカウント削除ができます。削除後も、利用者が書き出したファイル、端末内のコピー、サービスの保持設定に基づく復旧用バックアップが残る場合があります。</p>
    <p><a href="/log">Open CorkWill Log →</a></p>
  </main>;
}
