# Bulut yedeği kurulumu (Firebase)

Uygulama, `index.html` içindeki `const FB = null;` satırı doluysa Profil ekranında **Hesap** bölümünü gösterir: Google ile giriş, otomatik bulut yedeği, çıkış ve hesap silme. Boşken uygulama eskisi gibi yalnız cihazda çalışır.

## 1. Proje
1. https://console.firebase.google.com → **Proje ekle** → ad: `piril`. Google Analytics gerekmez, kapatılabilir.
2. Proje ana sayfasında **</>** (Web) simgesi → uygulama adı `Akımlı` → **Kaydet**. Firebase Hosting kutusunu işaretleme.
3. Gösterilen `firebaseConfig` içinden `apiKey`, `authDomain`, `projectId`, `appId` değerlerini kopyala.

## 2. Google ile giriş
1. **Authentication** → **Başlayın** → **Sign-in method** → **Google** → Etkinleştir → destek e-postasını seç → Kaydet.
2. **Authentication → Settings → Authorized domains** → **Alan adı ekle** → `abfagur2020-collab.github.io`.

## 3. Veritabanı
1. **Firestore Database** → **Veritabanı oluştur** → konum `eur3 (europe-west)` → **Üretim modunda başla**.
2. **Kurallar** sekmesine bu klasördeki `firestore.rules` dosyasının içeriğini yapıştır → **Yayınla**.

## 4. Uygulamaya bağla
`index.html` içinde:
```js
const FB = { apiKey: '…', authDomain: 'piril-xxxx.firebaseapp.com', projectId: 'piril-xxxx', appId: '1:…:web:…' };
```
Bu değerler gizli bilgi değildir (her Firebase web uygulamasında sayfanın içinde durur); veriyi kurallar korur.

## Nasıl çalışır
- Giriş isteğe bağlıdır. Girişsiz kullanım tam çalışır (App Store 5.1.1(v)).
- Her kullanıcının tek belgesi vardır: `users/{uid}`. Cevaplardan 3 sn sonra yazılır; uygulama arka plana geçince hemen yazılır.
- Her yazmadan önce bulut okunur. Başka cihaz daha yeni bir kayıt bıraktıysa birleştirilir: XP'si yüksek olan temel, biten derslerin en iyi puanı ve en uzun seri ikisinden alınır.
- Hesabı sil: bulut belgesi ve Firebase kullanıcısı silinir, bu cihazdaki ilerleme kalır (App Store ve Google Play hesap silme şartı).
- Ücretsiz Spark planı bu kullanım için yeterlidir (yazma başına 1 okuma + 1 yazma).

## Mağaza için ileride
- iOS sürümünde Google girişi varsa **Apple ile Giriş** de eklenmeli (App Store 4.8).
- Gizlilik politikası ve KVKK aydınlatma metni gerekir: toplanan veri e-posta, ad ve uygulama ilerlemesidir.

Test: `node tests/bulut.mjs` (sahte Firebase ile, internet gerekmez).
