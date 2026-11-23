# RoadDash – Yapılacaklar

Tamamlananları `[x]` ile işaretle. Başlıklar önem sırasına göre dizili (22.11.2026). Önce riski azaltan küçük işler gelir, sonra başka işlerin dayandığı temel (kullanıcı verisinin sunucuya taşınması ve vektör altyapısı), ardından içerik ve yeni özellikler. Canlıya çıkış en sonda.

**Bugünün planı (22.11.2026):** 1 ve 2 bitecek, 3'ün altyapı kısmı (pgvector, model, arka plan üretimi, ilk vektörler) yapılacak, sonra 4'e (içerik) geçilecek. Durum: 1 (PR ve Supabase şifre ayarı hariç), 2 ve 3 bitti; sıradaki 4.

## 1. Hemen: güvenlik ve bakım
Küçük ve hızlı işler; açık riskleri kapatır.
- [x] Next.js'i 16.3.5'ten 16.4.6'ya yükselt; `npm audit fix` ile sharp ve source-map-js'i güncelle (epubjs'in xmldom'u 0.8.15'e sabitlendi; `npm audit`: 0 açık)
- [x] Supabase şifre ayarları: en az 8 karakter; küçük harf, büyük harf, rakam ve sembol; güvenli şifre değişimi (kayıt ve sıfırlama ekranları aynı kuralı önceden kontrol ediyor; ölçülerek doğrulandı)
- [ ] Dalları main'e birleştir (`feat/supabase` … `feat/game-word-road`, tek PR)
- [x] PR'larda otomatik tip ve lint kontrolü (CI: `.github/workflows/ci.yml`; tip, lint, build, bağımlılık taraması)
- [x] Gemini model adını güncelle: `gemini-3.8-flash` (`GEMINI_MODEL`), meşgulse `gemini-3.6-flash` (`GEMINI_FALLBACK_MODEL`); deneme başına 25 sn, toplam 40 sn sınır
- [x] Giriş kartındaki "English Writing Practice" yazısını "TOEFL Hazırlık" yap
- [x] Eski stash'i sil: "mobile-infra WIP before rebase on main" (içeriği dalda zaten vardı; gerekirse `ef8f1be`)

Biten güvenlik ve Supabase işleri:
- [x] Supabase projesi (AB / Frankfurt), anahtarlar `.env.local`'da, migration'lar çalıştı (tablolar, sayaç fonksiyonları, RLS doğrulandı)
- [x] Giriş dönüş adresleri (`/auth/callback`; localhost:3000 ve 3001)
- [x] Uçtan uca: e-posta + şifre ile giriş, oturumun korunması, girişsiz isteklerin reddi, şifre sıfırlama ekranı, demo ödeme ve iptal, `QUOTA_ENFORCE=1` ile günlük sayaçlar
- [x] Supabase modunda yapay zekâ rotaları girişsiz çağrılamaz
- [x] Canlıda Supabase yoksa tarayıcının plan bilgisine güvenilmez (herkes Başlangıç planı, IP'ye göre; `DEMO_PAYMENTS=1` ile demo açılabilir)
- [x] Yapay zekâya giden tüm alanlarda uzunluk sınırı
- [x] Güvenlik başlıkları (çerçeve engeli, `nosniff`, referrer politikası, CSP)
- [x] Hata cevaplarında iç ayrıntı (`detail`) canlıda gösterilmez
- [x] Dakikalık istek sınırı, sunucular arasında ortak (`rate_limits` + `rate_limit_hit`; veritabanı yoksa bellek)
- [x] `profiles.name` için 80 karakter sınırı (kullanıcı profilde yalnızca adını değiştirebilir)

## 2. Kullanıcı verisini sunucuya taşı (temel)
Günün Bulmacası, kişisel koç, admin istatistikleri ve KVKK'daki silme hakkı bu başlığa dayanıyor; bu yüzden ilk büyük iş bu.
- [x] Yazılar ve geri bildirimler için `writings` ve `writing_feedback` tabloları (asıl veri normal kolonlarda; `source`: ai / mock / import)
- [x] Puanlama sonucunu sunucu kaydetsin; kullanıcı kendi puanını yazamasın (sunucu kayıtlı metni puanlar; doğrudan yazma 42501 ile reddediliyor)
- [x] E-posta alıştırmaları için `email_exercises` tablosu (puanlama başarısız olsa da e-posta kaydedilir)
- [x] Hedef puan, seçilen sınav ve seviye testi sonucunu `profiles` tablosuna taşı (girişte tarayıcıya kopyalanır, çıkışta silinir)
- [x] İlk girişte tarayıcıda kalan eski yazıları ve e-postaları bir kez hesaba aktar (tekrar gönderilirse çoğalmaz)
- [x] Hesap silme: profilde "Hesabımı sil" (SİL yazarak onay); hesap, yazılar, puanlar, e-postalar, vektörler ve sayaçlar silinir
- [x] Eski `usage_daily` ve `rate_limits` satırlarını düzenli temizle (pg_cron: 30 günden eski sayaçlar her gece, 1 saatten eski sınır satırları her saat)

## 3. Vektör altyapısı
Vektör, anlama göre arama yapmayı sağlayan bir dizindir, veriyi saklamanın bir yolu değildir; veriyi küçültmez, aksine büyütür. Kurallar:
- Asıl veri her zaman normal tablolarda durur. Vektörler ayrı tablolarda tutulur ve asıl satıra `on delete cascade` ile bağlanır (KVKK: yazıdan üretilen vektör de kişisel veridir).
- Bütün vektörler tek bir modelle üretilir. Model değişirse hepsinin yeniden üretilmesi gerekir, bu yüzden model bir kez seçilir.
- Vektörler arka planda üretilir; kullanıcı kaydetme sırasında beklemez.
- Puan, sayaç, abonelik, ödeme ve profil bilgileri vektörlenmez.

Yapılacaklar:
- [x] Supabase'te `pgvector` eklentisini aç
- [x] Embedding modelini seç ve vektör boyutunu sabitle: Ollama `nomic-embed-text`, 256 boyut (`src/lib/ai/embeddings.ts`); yerelde ücretsiz, yazı başına ~1 KB
- [ ] Canlı sunucuda embedding'in nerede çalışacağını ve maliyetini belirle (9. başlıktaki barındırma ile birlikte)
- [x] Arka planda vektör üretimi: cevap gönderildikten sonra (`after`), her kayıtta bekleyen birkaç eski yazı da tamamlanır
- [x] İlk vektörler: kullanıcı yazıları (`writing_embeddings`, yazı başına tek vektör), benzer yazı araması ve yazı ekranında "Bu konuya yakın yazıların" (eşik 0.75)
- [x] Ollama kapalıyken uygulama çalışmaya devam etsin (vektör tablosu yokken denendi: kayıt ve puanlama etkilenmedi)

## 4. İçerik ve eksik özellikler
Kullanıcının her gün gördüğü şey içerik; az olduğu için hızla tekrar ediyor.
- [x] Konuşma bölümünde **Listen and Repeat**: 7 cümle, sunucu sesi, tarayıcı konuşma tanıma, kelime kelime 0–5 puan, desteklemeyen tarayıcıda yazarak çalışma
- [ ] Listen and Repeat içeriğini çoğalt: seviye başına en az 10 set (`--tasks listen-repeat`), elle gözden geçir (canlı üretim kapalı; şu an seviye başına 2 elle yazılmış set var)
- [ ] Listen and Repeat'i gerçek mikrofonla Chrome, Edge ve Safari'de (iPhone dahil) dene
- [x] Hata Avı: altyapı, oyun ekranı, oyunlar sayfası, ana sayfa ve kenar çubuğu girişleri
- [ ] Hata Avı içeriğini çoğalt: seviye başına en az 20 tur (`npm run content:generate -- --tasks error-hunt --target 20`) ve elle gözden geçir
- [ ] Hata Avı içeriğini daha güçlü bir modelle üretmeyi değerlendir (yerel küçük model bazen doğru ifadeyi hata sayıyor; ikinci kontrol bunu azaltıyor ama sıfırlamıyor)
- [x] Kelime Yolculuğu: 8 duraklı yol, boşluk ve eş anlam soruları, 3 can, durak süresi, sonda kelime listesi
- [ ] Kelime Yolculuğu içeriğini çoğalt: seviye başına en az 15 yol (`--tasks word-road`), elle gözden geçir (yerel model kelime türü uyuşmazlığı ve iki doğru şık üretebiliyor)
- [ ] Konuşma için Gemini sağlayıcısını tamamla (şu an taslak)

## 5. Kütüphane (RAG)
3. başlıktaki vektör altyapısını kullanır.
- [ ] Kütüphane: telif sorunu olmayan kitapları ekle (ör. Project Gutenberg); bölümlere ayır, parçala, vektörleriyle birlikte sakla (en büyük yer kalemi bu olacak)
- [ ] Kitaptan soru üret: seçilen bölümden TOEFL tarzı okuma soruları; cevap ve açıklama yalnızca metne dayansın
- [ ] Kitaba soru sor: kullanıcının sorusuyla ilgili parçaları bulup cevapla, kaynak paragrafı göster

## 6. Admin paneli
- [ ] İçerik bankasını (`content/bank/*.json`) tabloya taşı, admin rolü ekle
- [ ] İçeriklere vektör ekle: üretim sırasında birbirine çok benzeyenleri ele, "bu konuda başka bir metin" öner, kullanıcının zayıf olduğu konuya göre içerik seç
- [ ] İçerik denetimi: üretilen okuma ve dinleme içeriklerini önizle, hatalıları sil (dinlemede yanlış şıkların doğru cevap olabildiği görüldü)
- [ ] Kullanım ve maliyet: günlük yapay zekâ çağrıları, özellik bazında kullanım, tahmini maliyet
- [ ] Kullanıcılar ve planlar: plan değiştirme, iade, destek
- [ ] Ayarlar: plan limitlerini ve canlı yapay zekâyı kod değiştirmeden yönet

## 7. Kişisel koç ve Günün Bulmacası
2. başlıktaki sunucu verisine ve 3. başlıktaki yazı vektörlerine dayanır.
- [ ] Kişisel koç: "bu konuda daha önce de yazmıştın" uyarısı, tekrarlayan hatalar, geçmiş yazılara bakarak kişisel geri bildirim
- [ ] Günün Bulmacası: herkese aynı tur, seri, sıralama; puan sunucuda doğrulanmalı

## 8. Ödeme
Onay bildirimi (webhook) canlı bir adres istediği için yayına yakın yapılır.
- [ ] Web için ödeme sağlayıcısı seç (iyzico veya PayTR); onay bildirimini `subscriptions` ve `payments` tablolarına yazdır
- [ ] Mobil için App Store ve Google Play uygulama içi satın alma (RevenueCat gibi bir aracı ile)
- [ ] Pro yenilemesinde dönem sonunu ödeme bildirimiyle uzat
- [ ] Kurumsal plan (planlar sayfasında "Yakında" olarak duruyor): toplu öğrenci hesabı ve tek fatura, öğretmen paneli (ödev, deneme sınavı), öğrenci ilerleme raporları

## 9. Canlıya çıkış
- [ ] Alan adı al (ör. `roaddash.app`, yılda yaklaşık 10–20 $); sunucu, e-posta ve Google onay ekranı için gerekli
- [ ] Canlı sunucu: uygulama, yapay zekâ modeli (Ollama) ve ses servisi (pocket-tts) için barındırma
- [ ] Supabase'e canlı dönüş adresini ekle (`https://<alan adı>/auth/callback`)
- [ ] Canlı ortam değişkenleri: `DEMO_PAYMENTS` boş (demo ödeme kapalı), `QUOTA_ENFORCE=1`, `RATE_LIMIT` açık
- [ ] KVKK aydınlatma metni ve gizlilik politikası (Google onay ekranı için de gerekli)
- [ ] E-postaları kendi adımızla gönder (şu an Supabase'in deneme servisi kullanılıyor: yalnızca ekip adreslerine, saatte birkaç e-posta gidiyor)
  - [ ] E-posta servisi seç ve hesap aç (önerilen: Resend, ücretsiz olarak ayda 3.000 / günde 100; alternatif: Brevo, günde 300)
  - [ ] Alan adına servisin DNS kayıtlarını ekle (SPF, DKIM, DMARC) ve doğrulat
  - [ ] Supabase → Authentication → SMTP Settings: gönderen `RoadDash <destek@roaddash.app>`, servisin SMTP bilgileri
  - [ ] Supabase → Authentication → Rate Limits: saatlik e-posta sınırını yükselt
  - [ ] Türkçe e-posta şablonları (kayıt doğrulama, şifre sıfırlama, e-posta değişikliği, sihirli bağlantı): RoadDash görünümünde hazırla, Supabase → Email Templates'e yapıştır
  - [ ] Gerçek adreslerle dene (Gmail, Outlook, iCloud): kayıt doğrulama ve şifre sıfırlama e-postaları gelen kutusuna mı düşüyor, spam'e mi
- [ ] Google girişi: Google Cloud'da OAuth istemcisi aç, Supabase'te Google sağlayıcısını etkinleştir, uçtan uca dene
- [ ] Mobil uygulamada Google girişi (Capacitor dönüş bağlantısı / deep link)
- [ ] Sızmış şifre koruması: Supabase Pro planında açılıyor; ücretli plana geçince aç
- [ ] Deneme hesaplarını sil (`deneme@roaddash.test`)
