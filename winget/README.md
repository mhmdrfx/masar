# نشر برنامج Masar على متجر Windows Package Manager (winget)

بمجرد قبول الحزمة في مستودع winget الرسمي التابع لمايكروسوفت (`microsoft/winget-pkgs`)، سيتمكن أي مستخدم ويندوز من تثبيت وتحديث البرنامج مباشرة من موجه الأوامر (CMD أو PowerShell) بدون الحاجة لفتح المتصفح:

```powershell
# لتثبيت البرنامج:
winget install mhmdrfx.Masar

# لتحديث البرنامج في أي وقت:
winget upgrade mhmdrfx.Masar
```

---

## الطريقة الرسمية الأسهل للنشر (باستخدام أداة wingetcreate)

مايكروسوفت توفر أداة رسمية اسمها **wingetcreate** تقوم بفحص رابط التحميل واستخراج الهاش وإنشاء الـ Pull Request تلقائياً:

### الخطوة 1: تثبيت أداة wingetcreate (مرة واحدة فقط)
افتح PowerShell وشغّل:
```powershell
winget install Microsoft.WingetCreate
```

### الخطوة 2: إنشاء رمز وصول (GitHub Personal Access Token)
1. افتح صفحة [GitHub Personal Access Tokens (classic)](https://github.com/settings/tokens/new).
2. اختر اسماً للرمز (مثلاً: `winget-submit`).
3. حدد صلاحية **`public_repo`**.
4. اضغط **Generate token** وانسخ الرمز الناتج.

### الخطوة 3: إرسال الحزمة للمراجعة بضغطة واحدة
شغّل الأمر التالي وضع رمز الـ Token عند طلبه:
```powershell
wingetcreate submit https://github.com/mhmdrfx/masar/releases/download/v1.0.0/Masar-Setup.exe --token <YOUR_GITHUB_TOKEN>
```

ستقوم الأداة تلقائياً بإنشاء فرع (Fork) وتقديم طلب دمج (Pull Request) رسمي إلى `microsoft/winget-pkgs`. تقوم بوتات مايكروسوفت بفحص الملف وتثبيته في بيئة افتراضية للتأكد من خلوه من أي مشاكل، وتتم الموافقة عليه ونشره عادة خلال 24 إلى 48 ساعة.

---

## ملفات المانيفست الجاهزة (Manifests)

تم تجهيز جميع ملفات المانيفست المعتمدة وفقاً لمعيار مايكروسوفت `v1.6.0` داخل المجلد:
`winget/manifests/m/mhmdrfx/Masar/1.0.0/`
- `mhmdrfx.Masar.yaml`: ملف تعريف الإصدار
- `mhmdrfx.Masar.installer.yaml`: معرّف المثبت وهاش التشفير (SHA-256) ومفاتيح السجل
- `mhmdrfx.Masar.locale.en-US.yaml`: بيانات المطور والوصف والوسوم ورابط الترخيص
