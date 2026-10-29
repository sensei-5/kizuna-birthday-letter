// Supabase 連線設定（留言頁、管理頁、生日信共用）
// 這兩個值本來就是公開的；權限由資料庫的 RLS 規則把關
window.WISH_CONFIG = {
  supabaseUrl: 'https://yqewaxgvjlkyzmlqnoxy.supabase.co',
  supabaseKey: 'sb_publishable_QtOrorJ6PtKGoE4TVpgL8Q_b2NyDfxP',
  maxMessage: 100, // 留言字數上限（要和資料庫的 check 一致）
  maxName: 30,
};
