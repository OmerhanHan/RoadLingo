# RoadLingo – Yapılacaklar

Tamamlananları `[x]` ile işaretle. Sıra kabaca önceliği gösterir.

## 1. Supabase'i bağla (kod hazır, `feat/supabase`)
Adımlar: [supabase/README.md](supabase/README.md)
- [ ] Supabase projesi aç (AB / Frankfurt), üç anahtarı `.env.local`'a yaz
- [ ] `supabase/migrations/*.sql` dosyasını SQL Editor'da çalıştır
- [ ] Giriş dönüş adreslerini ekle (`/auth/callback`)
- [ ] Google Cloud'da OAuth istemcisi aç, Supabase'te Google sağlayıcısını etkinleştir
- [ ] Uçtan uca dene:
  - [ ] kayıt ve e-posta doğrulama
  - [ ] Google girişi
  - [ ] şifre sıfırlama
  - [ ] demo ödeme ve iptal
  - [ ] `QUOTA_ENFORCE=1` ile günlük sayaçlar
- [ ] `feat/supabase` için PR aç ve main'e birleştir

## 2. Kullanıcı verisini sunucuya taşı (Aşama 3)
- [ ] Yazılar ve geri bildirimler için `writings` ve `writing_feedback` tabloları
- [ ] Puanlama sonucunu sunucu kaydetsin; kullanıcı kendi puanını yazamasın
- [ ] E-posta alıştırmaları için `email_exercises` tablosu
- [ ] Hedef puan, seçilen sınav ve seviye testi sonucunu `profiles` tablosuna taşı
- [ ] İlk girişte tarayıcıda kalan eski yazıları bir kez hesaba aktar
- [ ] Eski `usage_daily` satırlarını düzenli temizle (ör. 30 günden eski; pg_cron)

## 3. Ödeme
- [ ] Web için ödeme sağlayıcısı seç (iyzico veya PayTR); onay bildirimini (webhook) `subscriptions` ve `payments` tablolarına yazdır
- [ ] Mobil için App Store ve Google Play uygulama içi satın alma (RevenueCat gibi bir aracı ile)
- [ ] Pro yenilemesinde dönem sonunu ödeme bildirimiyle uzat
- [ ] Canlıda demo ödemeyi kapalı tut (`DEMO_PAYMENTS` boş)

## 4. Uygulama özellikleri
- [ ] Konuşma bölümüne **Listen and Repeat** görevini ekle (`listen-repeat`, şu an `status: 'soon'`)
- [ ] Mobil uygulamada Google girişi (Capacitor dönüş bağlantısı / deep link)
- [ ] Giriş kartındaki "English Writing Practice" yazısını "TOEFL Hazırlık" gibi bir ifadeyle değiştir
- [ ] Gemini model adını güncelle (`gemini-1.5-flash`: analyze, analyze/email, topic)
- [ ] Konuşma için Gemini sağlayıcısını tamamla (şu an taslak)

## 5. Admin paneli
- [ ] İçerik bankasını (`content/bank/*.json`) tabloya taşı, admin rolü ekle
- [ ] İçerik denetimi: üretilen okuma ve dinleme içeriklerini önizle, hatalıları sil (dinlemede yanlış şıkların doğru cevap olabildiği görüldü)
- [ ] Kullanım ve maliyet: günlük yapay zekâ çağrıları, özellik bazında kullanım, tahmini maliyet
- [ ] Kullanıcılar ve planlar: plan değiştirme, iade, destek
- [ ] Ayarlar: plan limitleri ve canlı yapay zekâyı kod değiştirmeden yönet

## 6. Canlıya çıkış
- [ ] Canlı sunucu: uygulama, yapay zekâ modeli (Ollama) ve ses servisi (pocket-tts) için barındırma
- [ ] E-posta servisi bağla (Supabase → SMTP Settings; Resend, Postmark vb.)
- [ ] KVKK aydınlatma metni ve gizlilik politikası (Google onay ekranı için de gerekli)
- [ ] PR'larda otomatik tip ve lint kontrolü (CI)

## Temizlik
- [ ] Eski stash'i sil: "mobile-infra WIP before rebase on main"
