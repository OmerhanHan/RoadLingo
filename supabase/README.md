# Supabase kurulumu

Anahtarlar girilmediği sürece uygulama demo modunda çalışır: sahte giriş, plan tarayıcıda, sayaçlar sunucu belleğinde. Aşağıdaki adımlar tamamlanınca gerçek giriş, sunucuda tutulan abonelik ve kalıcı günlük sayaçlar devreye girer.

## 1. Proje
1. [supabase.com](https://supabase.com) üzerinde yeni proje aç. Bölge olarak **Central EU (Frankfurt)** seç.
2. **Project Settings → API** sayfasından üç değeri `.env.local`'a yaz:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<proje>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```
   - Eski projelerde bu iki anahtarın adı `anon` ve `service_role`. Kod iki adlandırmayı da tanır.
   - Gizli anahtar (`SUPABASE_SECRET_KEY`) sadece sunucuda durur. Başına asla `NEXT_PUBLIC_` ekleme, sohbete ya da depoya koyma.

## 2. Tablolar
**SQL Editor**'da `migrations/` klasöründeki dosyaları tarih sırasıyla çalıştır. Supabase CLI kuruluysa aynı işi `supabase db push` da yapar.

Bu dosyalar şunları kurar:
- **`profiles`:** Kayıtta otomatik oluşur.
- **`subscriptions` ve `payments`:** Sadece sunucu yazar.
- **`usage_daily`:** Günlük sayaçlar.
- **`consume_usage` ve `refund_usage`:** Sayaç fonksiyonları, sadece sunucu çağırabilir.
- **`rate_limits` ve `rate_limit_hit`:** Dakikalık istek sınırı. Bütün sunucular aynı sayacı kullanır; tabloya sadece sunucu erişir.
- **Erişim kuralları (RLS):** Her kullanıcı yalnızca kendi satırlarını okuyabilir.
- **Profil:** Ad en fazla 80 karakter. Kullanıcı kendi profilinde yalnızca adını, seçtiği sınavı (`selected_exam`), hedef puanını (`target_score`) ve seviye testi sonucunu (`placement`) değiştirebilir.
- **`writings` ve `writing_feedback`:** Yazılar ve puanları. Yazıyı sunucu kaydeder; puanlarken metni veritabanından okur ve sonucu kendisi yazar. Kullanıcı yalnızca okuyabilir, kendine puan veremez. `source` alanı puanın nereden geldiğini gösterir: `ai` (model), `mock` (geliştirmede model yokken örnek puan), `import` (hesap açılmadan önce tarayıcıda verilen puan).
- **`email_exercises`:** E-posta alıştırmaları ve analizleri; yazma kuralı aynı.
- **Eski tarayıcı verisi:** İlk girişte tarayıcıda kalan yazılar ve e-postalar bir kez hesaba aktarılır (`source = 'import'`, tekrar gönderilirse çoğalmaz).
- **Hesap silme:** Profil sayfasındaki "Hesabımı sil" bağlantısı hesabı ve ona ait her şeyi siler (`on delete cascade`).
- **Temizlik (pg_cron):** 30 günden eski günlük sayaçlar her gece, 1 saatten eski dakikalık sınır satırları her saat silinir. **Integrations → Cron** sayfasında `roaddash-cleanup-*` adlı iki iş görünür.
- **Vektörler (pgvector):** `writing_embeddings` her yazı için bir vektör tutar (`nomic-embed-text`, 256 boyut). Yalnızca sunucu erişir; yazı veya hesap silinince vektör de silinir. Ayrıntı aşağıda.

## 3. Giriş adresleri
**Authentication → URL Configuration**:
- **Site URL:** canlı adres (geliştirmede `http://localhost:3000`)
- **Redirect URLs:**
  - `http://localhost:3000/auth/callback`
  - `https://<canlı-alan-adı>/auth/callback`

E-posta doğrulaması **Authentication → Providers → Email** altında açık kalsın. Supabase'in yerleşik e-posta servisi saatte birkaç e-postayla sınırlı. Canlıya çıkmadan önce **Authentication → SMTP Settings** altında bir e-posta servisi (Resend, Postmark vb.) bağla.

### Şifre kuralları
**Authentication → Providers → Email** (yeni arayüzde **Sign In / Providers → Email**):
- **Minimum password length:** 8. Uygulama da en az 8 karakter ister (`MIN_PASSWORD`, `src/lib/auth/config.ts`); ikisi aynı kalmalı.
- **Password requirements:** En az harf ve rakam.
- **Secure password change:** Açık. Şifre değiştirmek için yakın zamanda giriş yapmış olmak gerekir.
- **Prevent use of leaked passwords:** Sızmış şifreleri reddeder. Supabase'in ücretli (Pro) planında açılabiliyor; ücretsiz planda bu seçenek kapalı kalır.

## 4. Google ile giriş
1. [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials → Create credentials → OAuth client ID** → *Web application*.
2. **Authorized JavaScript origins:**
   - `http://localhost:3000`
   - canlı adres
3. **Authorized redirect URIs:** `https://<proje>.supabase.co/auth/v1/callback`. Bu adres Supabase'in Google sağlayıcı sayfasında da yazar.
4. Oluşan Client ID ve Client Secret'ı Supabase'te **Authentication → Providers → Google** altına gir ve sağlayıcıyı aç.
5. **OAuth consent screen:** Uygulama adı RoadDash, destek e-postası ve gizlilik politikası adresi gir.

Mobil uygulamada (Capacitor) Google girişi için ayrıca uygulama içi dönüş bağlantısı (deep link) gerekir. Bu ayrı bir adım olarak yapılacak.

## 5. Vektörler
Yazıların vektörleri "bu konuya yakın yazıların" listesini besler; ileride kütüphane (RAG) ve kişisel koç da aynı altyapıyı kullanacak.
1. Sunucunun eriştiği Ollama'da modeli indir: `ollama pull nomic-embed-text` (yaklaşık 270 MB).
2. Yazı kaydedilince vektörü cevap gönderildikten sonra arka planda üretilir; kullanıcı beklemez.
3. Ollama kapalıysa uygulama çalışmaya devam eder. Vektörü olmayan yazılar sırada bekler ve sonraki kayıtlarda birkaçar birkaçar tamamlanır.
4. Vektör üretimini kapatmak için `EMBEDDINGS=0`.

Model veya boyut değişirse bütün vektörlerin yeniden üretilmesi gerekir. `EMBEDDING_MODEL` ve `EMBEDDING_DIMENSIONS` (`src/lib/ai/embeddings.ts`) ile tablodaki `vector(256)` aynı kalmalı.

## 6. Kontrol
1. `npm run dev` ile uygulamayı başlat.
2. Kayıt ol ve e-postadaki bağlantıya tıkla. Profil Table Editor'da `profiles` tablosunda görünmeli.
3. Planlar sayfasından demo ödeme yap. Satır `subscriptions` ve `payments` tablolarında görünmeli.
4. `QUOTA_ENFORCE=1` ile bir yazı değerlendir. Sayaç `usage_daily` tablosunda artmalı.
5. Yazı `writings`, puanı `writing_feedback`, birkaç saniye sonra vektörü `writing_embeddings` tablosunda görünmeli.

Kullanıcının planını elle değiştirmek için `subscriptions` tablosunda `plan_id` ve `current_period_end` alanlarını düzenlemek yeterli. Değişiklik en geç 30 saniye içinde geçerli olur.
