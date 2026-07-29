"""Host (PostgreSQL) yetki zinciri sorgularının SQL metinleri (tek yer).

Neden: yetki_repository.py yalnızca bağlantı yönetimi, sonuç dönüşümü ve hata
sarmalama sorumluluğunu taşısın; ham SQL metinleri buraya ayrılır (proje
konvansiyonu, SRP). Tüm sorgular parametrelidir (%s); string birleştirme YASAK —
değerler cursor.execute'a ayrı geçirilir (SQL injection'a kapalı).

Bu dosyadaki tablolar HOST'a aittir (savronik'in çalışan sistemi); replikası
database/migrations_pg/001 + 003 + 006 ile kurulur. Şema BİZİM değildir, DDL
buradan yazılmaz.
"""

# Bir personelin (staff_id) verilen SAYFA üzerinde hakkı olup olmadığını sorar.
# Zincir: "user" (hesap) -> rolerightmapping (rolün hakları) -> roleright (hak =
# sayfa + yetenek) -> webpage (sayfa adı). "user".id = staff.staff_id (1:1, aynı
# değer; bkz. 003_host_user.sql) olduğundan oturumdaki sicil doğrudan u.id'dir.
#
# roleright_endpoint_mapping BİLEREK KULLANILMAZ: baktığımız tek şey sayfa
# görünürlüğüdür (4.6); yol öneki eşleştirmesi host'un kendi işidir ve '**' kalıp
# semantiği (S14 açık) SQL LIKE ile doğru karşılanmaz.
#
# Yetenek (ability_id) süzgeci YOKTUR: sayfaya bağlı HERHANGİ bir hak, sayfanın
# görünür olduğu anlamına gelir. LIMIT 1 -- varlık sorusu; satır içeriği kullanılmaz.
SAYFA_HAKKI_SORGUSU = """
    SELECT 1
    FROM "user" u
    JOIN rolerightmapping m ON m.role_id = u.role_id
    JOIN roleright r        ON r.id = m.right_id
    JOIN webpage w          ON w.id = r.webpage_id
    WHERE u.id = %s AND w.name = %s
    LIMIT 1
"""
