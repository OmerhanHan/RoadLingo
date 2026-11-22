# RoadDash – Yapılacaklar

Tamamlananları `[x]` ile işaretle. Sıra kabaca önceliği gösterir.

## 0. Güvenlik (ön analiz, 22.11.2026)
- [ ] Next.js'i 16.3.5'ten 16.4.6'ya yükselt; `npm audit fix` ile sharp ve source-map-js'i güncelle
- [x] Supabase modunda yapay zekâ rotaları girişsiz çağrılamasın (IP başlığı taklit edilip ücretsiz sınır aşılabiliyor)
- [x] Canlıda Supabase yoksa tarayıcının plan bilgisine güvenme (herkes Başlangıç planı, IP'ye göre; `DEMO_PAYMENTS=1` ile demo açılabilir)
- [x] Yapay zekâya giden tüm alanlara uzunluk sınırı koy (analyze `topic`; e-posta `to/subject/scenario`; tartışma puanlamada `prompt`)
- [x] Güvenlik başlıkları ekle: çerçeveye gömmeyi engelle, `nosniff`, referrer politikası, CSP
- [x] Hata cevaplarında iç ayrıntıları (`detail`) canlıda gösterme
- [x] Dakikalık istek sınırı (ses ve içerik rotaları için)
- [x] Dakikalık sınırı birden fazla sunucuda paylaşılır yap (`rate_limits` tablosu + `rate_limit_hit`; veritabanı yoksa bellek)
- [x] `profiles.name` için uzunluk sınırı (80 karakter; kullanıcı profilde sadece adını değiştirebilir)
- [ ] Supabase ayarları: en az 8 karakter, harf + rakam, güvenli şifre değişimi (uygulama tarafı 8 karakter istiyor)
- [ ] Sızmış şifre koruması: Supabase Pro planında açılıyor; ücretli plana geçince aç

## 1. Supabase'i bağla (kod hazır, `feat/supabase`)
Adımlar: [supabase/README.md](supabase/README.md)
- [x] Supabase projesi aç (AB / Frankfurt), üç anahtarı `.env.local`'a yaz
- [x] `supabase/migrations/*.sql` dosyasını SQL Editor'da çalıştır (tablolar, sayaç fonksiyonları ve RLS doğrulandı)
- [x] Giriş dönüş adreslerini ekle (`/auth/callback`; localhost:3000 ve 3001 doğrulandı, canlı adres yayına çıkarken eklenecek)
- [ ] Google Cloud'da OAuth istemcisi aç, Supabase'te Google sağlayıcısını etkinleştir
- [ ] Uçtan uca dene:
  - [x] e-posta + şifre ile giriş, oturumun yenilemede korunması, girişsiz isteklerin reddi
  - [ ] kayıt ve e-posta doğrulama (gerçek bir e-posta adresiyle)
  - [ ] Google girişi
  - [x] şifre sıfırlama ekranı (yeni şifre, 8 karakter kuralı, eski şifrenin geçersizleşmesi)
  - [ ] şifre sıfırlama e-postası (gerçek bir e-posta adresiyle)
  - [x] demo ödeme ve iptal
  - [x] `QUOTA_ENFORCE=1` ile günlük sayaçlar
- [ ] `feat/supabase` için PR aç ve main'e birleştir

## 2. Kullanıcı verisini sunucuya taşı (Aşama 3)
- [ ] Yazılar ve geri bildirimler için `writings` ve `writing_feedback` tabloları
- [ ] Puanlama sonucunu sunucu kaydetsin; kullanıcı kendi puanını yazamasın
- [ ] E-posta alıştırmaları için `email_exercises` tablosu
- [ ] Hedef puan, seçilen sınav ve seviye testi sonucunu `profiles` tablosuna taşı
- [ ] İlk girişte tarayıcıda kalan eski yazıları bir kez hesaba aktar
- [ ] Eski `usage_daily` ve `rate_limits` satırlarını düzenli temizle (ör. 30 günden eski / 1 günden eski; pg_cron)

## 3. Ödeme
- [ ] Web için ödeme sağlayıcısı seç (iyzico veya PayTR); onay bildirimini (webhook) `subscriptions` ve `payments` tablolarına yazdır
- [ ] Mobil için App Store ve Google Play uygulama içi satın alma (RevenueCat gibi bir aracı ile)
- [ ] Pro yenilemesinde dönem sonunu ödeme bildirimiyle uzat
- [ ] Canlıda demo ödemeyi kapalı tut (`DEMO_PAYMENTS` boş)
- [ ] Kurumsal plan (planlar sayfasında "Yakında" olarak duruyor): toplu öğrenci hesabı ve tek fatura, öğretmen paneli (ödev, deneme sınavı), öğrenci ilerleme raporları

## 4. Uygulama özellikleri
- [x] Konuşma bölümüne **Listen and Repeat** görevini ekle: 7 cümle, sunucu sesi, tarayıcı konuşma tanıma, kelime kelime 0–5 puan, desteklemeyen tarayıcıda yazarak çalışma
- [ ] Listen and Repeat içeriğini çoğalt: seviye başına en az 10 set (`--tasks listen-repeat`), elle gözden geçir (canlı üretim kapalı; şu an seviye başına 2 elle yazılmış set var)
- [ ] Listen and Repeat'i gerçek mikrofonla Chrome, Edge ve Safari'de (iPhone dahil) dene
- [ ] Mobil uygulamada Google girişi (Capacitor dönüş bağlantısı / deep link)
- [ ] Giriş kartındaki "English Writing Practice" yazısını "TOEFL Hazırlık" gibi bir ifadeyle değiştir
- [ ] Gemini model adını güncelle (`gemini-1.5-flash`: analyze, analyze/email, topic)
- [ ] Konuşma için Gemini sağlayıcısını tamamla (şu an taslak)

## 4b. Oyunlar (yapay zekâ çağırmaz, içerik bankasından gelir, her planda sınırsız)
- [x] Hata Avı: altyapı, oyun ekranı, oyunlar sayfası, ana sayfa ve kenar çubuğu girişleri
- [ ] Hata Avı içeriğini çoğalt: seviye başına en az 20 tur (`npm run content:generate -- --tasks error-hunt --target 20`) ve elle gözden geçir
- [ ] Hata Avı içeriğini daha güçlü bir modelle üretmeyi değerlendir (yerel küçük model bazen doğru ifadeyi hata sayıyor; ikinci kontrol bunu azaltıyor ama sıfırlamıyor)
- [x] Kelime Yolculuğu: 8 duraklı yol, boşluk ve eş anlam soruları, 3 can, durak süresi, sonda kelime listesi
- [ ] Kelime Yolculuğu içeriğini çoğalt: seviye başına en az 15 yol (`--tasks word-road`), elle gözden geçir (yerel model kelime türü uyuşmazlığı ve iki doğru şık üretebiliyor)
- [ ] Günün Bulmacası (Supabase sonrası: herkese aynı tur, seri, sıralama; puan sunucuda doğrulanmalı)

## 4c. Kütüphane (RAG)
- [ ] Kütüphane: kitapları (telif sorunu olmayan, ör. Project Gutenberg) ekle; bölümlere ayır, parçala ve vektör olarak sakla (Supabase pgvector)
- [ ] Kitaptan soru üret: seçilen bölümden okuma soruları (TOEFL tarzı), cevap ve açıklama yalnızca metne dayansın
- [ ] Kitaba soru sor: kullanıcının sorusuna ilgili parçaları bulup cevapla, kaynak paragrafı göster
- [ ] Embedding modeli seç (yerelde Ollama `nomic-embed-text` gibi) ve maliyet/plan sınırını belirle

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
