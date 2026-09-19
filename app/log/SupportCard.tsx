"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { cancelledPurchase, createSupportClient } from "../lib/support";
import type { SupportConfig, SupportStatus } from "../lib/support";
import type { Locale } from "../lib/types";

type Client = ReturnType<typeof createSupportClient>;

export default function SupportCard({ config, locale }: { config: SupportConfig; locale: Locale }) {
  const client = useRef<Client | null>(null);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const [status, setStatus] = useState<SupportStatus>({ active: false, price: "" });
  const [phase, setPhase] = useState<"loading" | "ready" | "busy" | "unavailable" | "error">("loading");
  const [notice, setNotice] = useState<"cancelled" | "error" | "restored" | "empty" | "pending" | "">("");
  const ja = locale === "ja";

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function initialize() {
      if (!Capacitor.isNativePlatform()) {
        if (!cancelled) setPhase("unavailable");
        return;
      }
      try {
        const { Purchases, LOG_LEVEL } = await import("@revenuecat/purchases-capacitor");
        await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
        const next = createSupportClient(Purchases, config);
        const result = await next.load();
        if (!cancelled) { client.current = next; setStatus(result); setPhase("ready"); }
      } catch {
        if (!cancelled) setPhase("error");
      }
    }
    void initialize();
    return () => { cancelled = true; mounted.current = false; client.current = null; };
  }, [config]);

  async function act(action: "purchase" | "restore") {
    if (!client.current || inFlight.current) return;
    inFlight.current = true;
    setPhase("busy");
    setNotice("");
    try {
      const result = await client.current[action]();
      if (!mounted.current) return;
      setStatus((previous) => ({ ...result, price: result.price || previous.price }));
      setNotice(action === "restore" ? (result.active ? "restored" : "empty") : (result.active ? "" : "pending"));
    } catch (error) {
      if (mounted.current) setNotice(cancelledPurchase(error) ? "cancelled" : "error");
    } finally {
      inFlight.current = false;
      if (mounted.current) setPhase("ready");
    }
  }

  const messages = {
    cancelled: ja ? "キャンセルしました。請求は発生していません。" : "Cancelled. Nothing was charged.",
    error: ja ? "接続できませんでした。時間をおいてお試しください。" : "Could not complete the request. Please try again.",
    restored: ja ? "テスト購入を復元しました。" : "Test purchase restored.",
    empty: ja ? "復元できるテスト購入はありませんでした。" : "No test purchase was found to restore.",
    pending: ja ? "購入の確認待ちです。特典はまだ有効になっていません。" : "Waiting for purchase confirmation. The badge is not active yet.",
    "": "",
  };

  return <section className="support-card" aria-labelledby="support-title" aria-busy={phase === "busy"}>
    <span className="support-test-label">{ja ? "無料のテスト体験" : "FREE TEST EXPERIENCE"}</span>
    <h1 id="support-title">{ja ? "CorkWillを応援する" : "Support CorkWill"}</h1>
    <p>{ja ? "毎日の記録、履歴、カスタマイズはすべて無料です。応援バッジのテスト購入を体験できます。" : "Daily logging, history, and customization stay free. Try a one-time test purchase for a supporter badge."}</p>
    <div className={`support-badge ${status.active ? "is-active" : ""}`} aria-live="polite">
      <span aria-hidden="true">{status.active ? "♥" : "♡"}</span>
      <div><strong>{status.active ? (ja ? "テストサポーター" : "Test supporter") : (ja ? "小さな応援、毎日の積み重ね" : "Small support. Steady progress.")}</strong><p>{status.active ? (ja ? "ありがとうございます。応援バッジが有効です。" : "Thank you. Your supporter badge is active.") : (ja ? "無理なく、自分のペースで。" : "Keep going at your own pace.")}</p></div>
    </div>
    <p className="support-disclosure">{ja ? "RevenueCat Test Storeを使用します。実際のお支払い・カード登録・自動更新はありません。" : "Uses RevenueCat Test Store. No real payment, card details, or automatic renewal."}{status.price && <span>{ja ? ` テスト上の表示価格：${status.price}` : ` Simulated price: ${status.price}.`}</span>}</p>
    {phase === "loading" && <p role="status">{ja ? "テスト商品を読み込み中…" : "Loading test product…"}</p>}
    {phase === "unavailable" && <p role="status">{ja ? "購入体験はiOSシミュレーター版でお試しください。" : "Open the iOS simulator build to try the purchase experience."}</p>}
    {phase === "error" && <p role="alert">{ja ? "Test Storeに接続できません。接続と設定を確認して画面を開き直してください。" : "Test Store is unavailable. Check the connection and configuration, then reopen this screen."}</p>}
    {(phase === "ready" || phase === "busy") && <div className="support-actions">
      {!status.active && <button className="primary-button" disabled={phase === "busy"} onClick={() => void act("purchase")}>{phase === "busy" ? (ja ? "処理中…" : "Working…") : (ja ? "無料でテスト購入" : "Try test purchase · no charge")}</button>}
      <button className="outline-button" disabled={phase === "busy"} onClick={() => void act("restore")}>{ja ? "テスト購入を復元" : "Restore test purchase"}</button>
    </div>}
    {notice && <p role={notice === "error" ? "alert" : "status"}>{messages[notice]}</p>}
    <p className="support-privacy">{ja ? "RevenueCatには購入用の匿名IDを送信します。日々の記録やメールアドレスは送信しません。" : "RevenueCat receives a pseudonymous purchase ID. Your daily records and email address are not sent."}</p>
  </section>;
}
