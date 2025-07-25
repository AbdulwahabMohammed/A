# نظام إدارة الشهادات الصحية

هذا المشروع عبارة عن مثال مبسط لتطبيق ويب لإدارة الشهادات الصحية والبحث عنها في ثلاث قواعد بيانات مختلفة.

## المتطلبات
- Node.js 18+
- MySQL يتضمن قواعد البيانات الثلاث وجداول `HC_HealthCertificate`.

## تشغيل الخادم
1. قم بتثبيت الحزم:
   ```bash
   npm install
   ```
2. تم تزويد ملف `backend/db.js` ببيانات الاتصال لثلاث قواعد مختلفة.
   عدِّلها إذا لزم الأمر لتناسب بيئتك.
   عند تشغيل الخادم سيظهر في سجل التشغيل ما إذا كان الاتصال بكل قاعدة تم بنجاح
   (`Database 1 connected` وهكذا). في حال وجود خطأ ستظهر رسالة توضح سبب المشكلة.
3. شغّل الخادم:
   ```bash
   npm start
   ```
4. افتح المتصفح على `http://localhost:3000`.

يتم جلب القوائم المنسدلة ديناميكياً من الخادم عبر واجهات REST، كما يوفر الخادم نقاط نهاية للبحث وتحديث حالة الشهادات.
تتضمن واجهة البحث فلتر "حالة الشهادة" لاختيار (نشطة أو موقوفة أو نصاب).
ملحوظة: إحدى قواعد البيانات تستخدم جدولاً باسم مختلف للموردين، لذا يعتمد الخادم على منطق ديناميكي يجرب أولاً جدول `HC_suppliers` ثم `Supplier` عند توفره لدعم القواعد الثلاث بدون تعارض.
عند عرض النتائج يظهر رقم القاعدة (1 أو 2 أو 3) بدلاً من اسمها.
تُعرض النتائج في صفحات بحد أقصى 20 سجل في الصفحة مع إظهار عدد السجلات الكلي، كما يتم تلوين حالة الشهادة بشارات ملونة لسهولة التمييز.
يمكن الضغط على رقم الشهادة لفتح صفحة الطباعة في نافذة جديدة.
إذا كانت الشهادة من القاعدة الأولى فسيكون رابط الطباعة على الشكل:
`https://s.mnaseb.com/lmbolwmy_newsickforemp/Print?uuid=<code>`،
أما بقية القواعد فتستخدم المسار `nPrint.php` كما هو محدد في الواجهة.

يعتمد المشروع على Bootstrap 5 بتنسيق RTL مع أيقونات Bootstrap Icons، واستخدام الخط الافتراضي "Segoe UI" لواجهة عربية أنيقة ومتجاوبة.

## التكامل مع GitHub

عند استقبال طلب webhook من GitHub (حدث `push`) على المسار `/webhook`,
يقوم الخادم بتنفيذ الأمر `git pull` داخل مجلد المشروع لتحديث الملفات.
يتم تسجيل نتيجة العملية في ملف `webhook.log` الموجود في جذر المشروع.
