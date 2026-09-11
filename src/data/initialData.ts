import { NewsItem, BannerSlide, DirectoryContact, MeetingRoom, PolicyDocument, SystemTool, SyncLog, AuditLog } from '../types';

export const INITIAL_NEWS: NewsItem[] = [
  {
    id: 'news-fraud-alert',
    title: 'บริษัทฯ ขอแจ้งเตือนภัยทุจริต (Anti-Fraud Alert)',
    titleEn: 'Anti-Fraud Alert: Official Warning Against Loan Impersonators',
    summary: 'เคบี เจ แคปปิตอล ขอแจ้งเตือนภัยจากกลุ่มมิจฉาชีพแอบอ้างชื่อบริษัทหรือบริการสินเชื่อ Kashjoy ในการหลอกลวงให้โอนเงินค่าธรรมเนียมหรือค้ำประกัน',
    content: `**บริษัท เคบี เจ แคปปิตอล จำกัด** ขอแจ้งเตือนประชาชนและลูกค้าทุกท่าน โปรดระมัดระวังกลุ่มมิจฉาชีพที่แอบอ้างชื่อบริษัท, เครื่องหมายการค้า หรือบริการสินเชื่อ **Kashjoy** ในการชักชวนกู้เงินผ่านช่องทางออนไลน์ที่ไม่เป็นทางการ

**ข้อสังเกตและแนวทางป้องกัน:**
1. **ไม่มีนโยบายเรียกเก็บเงินล่วงหน้า**: บริษัทไม่มีนโยบายเรียกเก็บเงินค่าค้ำประกัน ค่าธรรมเนียมการโอน หรือค่าดำเนินการใดๆ ก่อนการอนุมัติสินเชื่อทั้งสิ้น
2. **ช่องทางทางการเท่านั้น**: ตรวจสอบการสมัครผ่าน Application 'Kashjoy Easy' หรือเว็บไซต์ทางการ www.kbjcapital.co.th เท่านั้น
3. **บัญชีรับชำระ**: การชำระเงินค่างวดต้องโอนเข้าบัญชีนิติบุคคลในนาม 'บริษัท เคบี เจ แคปปิตอล จำกัด' เท่านั้น ห้ามโอนเข้าบัญชีบุคคลธรรมดา
4. **ติดต่อสายด่วน**: หากพบพฤติกรรมน่าสงสัย กรุณาติดต่อ Call Center โทร 1258 ทันที`,
    category: 'kbj-news',
    categoryLabel: 'News',
    badge: 'News',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '01 ส.ค. 2569',
    readTime: '3 นาที',
    author: 'สำนักความปลอดภัยและป้องกันการทุจริต (Fraud Prevention)',
    department: 'Risk Management',
    isImportantAlert: true,
    views: 3120,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'press-release'
  },
  {
    id: 'news-effective-rate',
    title: "รู้จัก 'ดอกเบี้ยลดต้นลดดอก' คืออะไร? เข้าใจ Effective Interest Rate ก่อนกู้เงินกับ Kashjoy",
    titleEn: 'Understanding Effective Interest Rate Before Applying for Kashjoy Loans',
    summary: 'ไขข้อข้องใจอัตราดอกเบี้ยแบบลดต้นลดดอก (Effective Rate) คำนวณอย่างไร ช่วยให้จ่ายหนี้หมดไวขึ้นอย่างไร พร้อมตัวอย่างการวางแผนชำระค่างวด',
    content: `การกู้ยืมเงินอย่างมีความรับผิดชอบเริ่มต้นที่การเข้าใจโครงสร้างดอกเบี้ย สินเชื่อส่วนบุคคลและบัตรกดเงินสด **Kashjoy Easy** ใช้วิธีคำนวณอัตราดอกเบี้ยแบบ **ลดต้นลดดอก (Effective Interest Rate)** สูงสุดไม่เกิน 25% ต่อปี ตามที่ธนาคารแห่งประเทศไทยกำหนด

**ข้อดีของดอกเบี้ยลดต้นลดดอก:**
- ดอกเบี้ยจะถูกคิดจาก 'เงินต้นคงเหลือจริง' ในแต่ละงวด
- ยิ่งชำระเงินต้นคืนมาก ดอกเบี้ยในงวดถัดไปจะลดลงตามสัดส่วน
- สามารถโปะเงินเพื่อปิดบัญชีก่อนกำหนดได้โดยไม่มีค่าปรับ

*คำเตือน: กู้เท่าที่จำเป็นและชำระคืนไหว เพื่อสร้างประวัติเครดิตที่ดีในระยะยาว*`,
    category: 'all-about-money',
    categoryLabel: 'All About Money',
    badge: 'All About Money',
    badgeColor: 'amber',
    imageUrl: 'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '14 ก.ค. 2569',
    readTime: '4 นาที',
    author: 'ฝ่ายสื่อสารผลิตภัณฑ์การเงิน (Consumer Finance Advisory)',
    department: 'Financial Literacy',
    views: 2450,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'money-tips'
  },
  {
    id: 'news-pdpa-consent',
    title: 'ประกาศการแจ้งเปลี่ยนแปลงข้อมูลส่วนบุคคล',
    titleEn: 'Announcement: Updates to Privacy Policy and Data Subject Rights Handling',
    summary: 'แจ้งปรับปรุงนโยบายการคุ้มครองข้อมูลส่วนบุคคล (Privacy Policy) เพื่อให้สอดคล้องกับแนวทางสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
    content: `เพื่อความโปร่งใสและสร้างความมั่นใจสูงสุดในการใช้บริการทางการเงิน บริษัท เคบี เจ แคปปิตอล จำกัด ได้ปรับปรุงประกาศนโยบายความเป็นส่วนตัว (Privacy Notice) ฉบับล่าสุด
- วัตถุประสงค์การเก็บรวบรวมและการใช้ข้อมูลเพื่อพัฒนาบริการสินเชื่อดิจิทัล
- การจัดเก็บรักษาความปลอดภัยของข้อมูลตามมาตรฐานสากล ISO/IEC 27001
- สิทธิของเจ้าของข้อมูลส่วนบุคคลในการเข้าถึง แก้ไข หรือเพิกถอนความยินยอม`,
    category: 'regulation',
    categoryLabel: 'News',
    badge: 'News',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '16 มิ.ย. 2569',
    readTime: '2 นาที',
    author: 'เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (Data Protection Officer - DPO)',
    department: 'Legal & Privacy',
    views: 1890,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'compliance'
  },
  {
    id: 'news-smart-borrowing',
    title: 'วางแผนกู้เงินฉุกเฉินอย่างชาญฉลาดและปลอดภัยกับ Kashjoy',
    titleEn: 'Smart Emergency Financial Planning with Kashjoy Easy Card',
    summary: 'เคล็ดลับการบริหารเงินสดสำรองสำหรับเหตุฉุกเฉิน การเลือกวงเงินที่เหมาะสม และเทคนิคสร้างวินัยทางการเงินเพื่อความมั่นคงในอนาคต',
    content: `ในยุคที่ความไม่แน่นอนทางเศรษฐกิจเกิดขึ้นได้ตลอดเวลา การมีวงเงินสำรองฉุกเฉินพร้อมใช้ เช่น **บัตรกดเงินสด Kashjoy Easy** ช่วยให้คุณรับมือกับค่าใช้จ่ายจำเป็นได้อย่างอุ่นใจ
- ตั้งงบประมาณสำรองฉุกเฉินอย่างน้อย 3-6 เท่าของค่าใช้จ่ายรายเดือน
- ใช้วงเงินเมื่อมีความจำเป็นจริง และวางแผนชำระคืนตรงเวลาทุกงวด
- ใช้ฟีเจอร์คำนวณค่างวดในแอป Kashjoy Easy เพื่อประเมินภาระก่อนตัดสินใจเบิกถอน`,
    category: 'lifestyle',
    categoryLabel: 'Lifestyle & Beliefs',
    badge: 'Lifestyle & Beliefs',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '02 มิ.ย. 2569',
    readTime: '5 นาที',
    author: 'ทีมสร้างเสริมวินัยทางการเงิน (Financial Wellness Team)',
    department: 'Marketing & PR',
    views: 2180,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'lifestyle'
  },
  {
    id: 'news-1',
    title: 'New Alert: แผนผังห้องประชุมใหม่ทั้งหมด (New Meeting Rooms Plan)',
    titleEn: 'New Alert: New Meeting Rooms Plan and Booking Procedure',
    summary: 'แจ้งปรับปรุงและจัดสรรแผนผังห้องประชุมสำนักงานใหญ่ ชั้น 14 และ 15 พร้อมระบบจองออนไลน์ผ่าน Intranet เพื่อความคล่องตัวในการปฏิบัติงาน',
    content: `ตามที่บริษัท เคบี เจ แคปปิตอล จำกัด ได้ดำเนินการปรับปรุงพื้นที่สำนักงานใหญ่และเพิ่มจำนวนห้องประชุมเพื่อรองรับการขยายตัวของทีมงาน โดยแบ่งเป็น:
- **ห้องประชุมชั้น 14**: Kookmin Room (รองรับ 20 ท่าน), Jaymart Hall (รองรับ 40 ท่าน), Sukhumvit Room (รองรับ 10 ท่าน)
- **ห้องประชุมชั้น 15**: Chao Phraya Room (รองรับ 8 ท่าน), Han River Room (รองรับ 12 ท่าน พร้อมระบบ Video Conference สำหรับประชุมกับเกาหลีใต้)

**ขั้นตอนการจองห้องประชุม:**
1. สามารถเข้าจองผ่านระบบ 'Meeting Room Booking' บน Intranet ได้ล่วงหน้าสูงสุด 14 วันทำการ
2. หากมีการยกเลิก กรุณายกเลิกในระบบก่อนเวลาประชุมอย่างน้อย 30 นาที เพื่อเปิดสิทธิ์ให้แผนกอื่นใช้งาน`,
    category: 'kbj-news',
    categoryLabel: 'KB J News',
    badge: 'NEW ALERT',
    badgeColor: 'red',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-18',
    author: 'แผนกบริหารสำนักงาน (Admin & Facilities)',
    department: 'General Affairs',
    isImportantAlert: true,
    views: 1420,
    syncToExternal: false,
    externalSyncStatus: 'draft'
  },
  {
    id: 'news-2',
    title: 'Link เข้าใช้งานระบบ KB J-E-DMS (Electronic Document Management System)',
    titleEn: 'Access KB J-E-DMS Portal for Digital Document Workflow',
    summary: 'ยกระดับองค์กรสู่ Paperless ด้วยระบบจัดเก็บและอนุมัติเอกสารอิเล็กทรอนิกส์ เข้าใช้งานสะดวกรวดเร็วผ่าน Single Sign-On',
    content: `บริษัทขอประชาสัมพันธ์การเปิดใช้งานระบบ **KB J-E-DMS** อย่างเป็นทางการ สำหรับการจัดทำ ส่งต่อ และลงนามเอกสารภายในองค์กรแบบดิจิทัล 100%
- รองรับการอนุมัติแบบ e-Signature ตามมาตรฐาน พ.ร.บ.ธุรกรรมอิเล็กทรอนิกส์
- จัดเก็บเอกสารแยกตามหมวดหมู่ แผนก และสิทธิ์การเข้าถึงอย่างปลอดภัย
- สามารถติดตามสถานะเอกสารได้แบบ Real-time`,
    category: 'kbj-news',
    categoryLabel: 'KB J News',
    badge: 'SYSTEM',
    badgeColor: 'blue',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-15',
    author: 'ฝ่ายเทคโนโลยีสารสนเทศ (IT Department)',
    department: 'Information Technology',
    views: 980,
    syncToExternal: false,
    externalSyncStatus: 'draft'
  },
  {
    id: 'news-3',
    title: 'Update New Logo! คู่มือการใช้งานโลโก้และ CI บริษัท (Corporate Identity Guidelines)',
    titleEn: 'Update New Logo! Corporate Identity (CI) Guidelines 2025',
    summary: 'ดาวน์โหลดชุดโลโก้ทางการของ KB J Capital และแนวทางการใช้งานฟอนต์ สีองค์กร เพื่อความเป็นเอกภาพของแบรนด์',
    content: `เพื่อเสริมสร้างภาพลักษณ์ความเป็นผู้นำสถาบันการเงินที่ทันสมัย ร่วมมือระหว่าง KB Financial Group และกลุ่ม Jaymart
ขอให้พนักงานทุกท่านใช้โลโก้และฟอนต์มาตรฐานตามคู่มือ **KB J Capital CI Standards**:
- โลโก้สัญลักษณ์ KB Star สีเหลืองประกาย (KB Gold #FFBC00) พร้อมตัวอักษรสี Charcoal (#2B2D42)
- ห้ามดัดแปลงสัดส่วน หรือนำไปวางบนพื้นหลังที่ทำให้สีผิดเพี้ยน
- ดาวน์โหลด Template สื่อนำเสนอ (PowerPoint), หัวจดหมาย, และลายเซ็นอีเมลได้จากเมนู Forms & Templates`,
    category: 'kbj-news',
    categoryLabel: 'KB J News',
    badge: 'BRANDING',
    badgeColor: 'amber',
    imageUrl: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-10',
    author: 'ฝ่ายสื่อสารองค์กรและการตลาด (Brand Marketing)',
    department: 'Marketing & PR',
    views: 1250,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'press-release'
  },
  {
    id: 'news-4',
    title: 'โครงการ "ปิดหนี้ไว ไปต่อได้" ร่วมกับบริษัท ข้อมูลเครดิตแห่งชาติ (NCB)',
    titleEn: 'NCB Campaign: Fast Debt Settlement for Financial Freedom',
    summary: 'โครงการพิเศษเพื่อช่วยเหลือลูกค้าปรับโครงสร้างหนี้ เสริมสภาพคล่อง และส่งเสริมวินัยทางการเงินอย่างยั่งยืน',
    content: `บริษัท ข้อมูลเครดิตแห่งชาติ จำกัด (เครดิตบูโร / NCB) ร่วมมือกับสถาบันการเงินชั้นนำ รวมถึง เคบี เจ แคปปิตอล เปิดตัวมาตรการ **"ปิดหนี้ไว ไปต่อได้"**
เพื่อสนับสนุนลูกหนี้รายย่อยที่ประสบปัญหาภาระหนี้สะสม สามารถเข้ารับคำปรึกษาและปรับปรุงเงื่อนไขการชำระให้สอดคล้องกับความสามารถที่แท้จริง
พร้อมสิทธิประโยชน์ด้านการบันทึกสถานะเครดิตอย่างเป็นธรรมหลังจากปิดบัญชีเสร็จสิ้น`,
    category: 'ncb-news',
    categoryLabel: 'NCB News',
    badge: 'NCB HIGHLIGHT',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-12',
    author: 'ฝ่ายบริหารหนี้และสินเชื่อ (Credit & Risk Operations)',
    department: 'Risk Management',
    views: 840,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'compliance'
  },
  {
    id: 'news-5',
    title: 'เครดิตบูโรคืออะไร ตั้งมาเพื่ออะไร และข้อมูลเครดิตสำคัญอย่างไร',
    titleEn: 'What is Credit Bureau (NCB) and Why Credit Information Matters',
    summary: 'บทความสาระน่ารู้สำหรับการให้คำแนะนำลูกค้าถึงประโยชน์ของประวัติเครดิตบูโรที่ดีในการขอรับบริการสินเชื่อ',
    content: `เครดิตบูโร หรือ บริษัท ข้อมูลเครดิตแห่งชาติ จำกัด ทำหน้าที่เป็นศูนย์กลางรวบรวมประวัติการชำระสินเชื่อของลูกค้า โดยไม่มีอำนาจในการอนุมัติหรือปฏิเสธสินเชื่อ
การรักษาประวัติการชำระที่ดีช่วยสร้างความน่าเชื่อถือทางการเงิน ทำให้ลูกค้าสามารถเข้าถึงบริการทางการเงินในอัตราดอกเบี้ยที่เป็นธรรมได้ง่ายขึ้น`,
    category: 'ncb-news',
    categoryLabel: 'NCB News',
    badge: 'KNOWLEDGE',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-04-28',
    author: 'สำนักกฎหมายและกำกับดูแล (Legal & Compliance)',
    department: 'Compliance',
    views: 630,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'compliance'
  },
  {
    id: 'news-6',
    title: 'ธปท. ประกาศมาตรการช่วยเหลือลูกหนี้ "คุณสู้ เราช่วย" และ "พักทรัพย์ พักหนี้"',
    titleEn: 'BOT Announcement: Debt Relief Programs and Financial Aid Measures',
    summary: 'แนวทางปฏิบัติของธนาคารแห่งประเทศไทยในการผ่อนปรนภาระหนี้สำหรับลูกค้ารายย่อยและผู้ประกอบการ',
    content: `ธนาคารแห่งประเทศไทย (ธปท.) ได้ออกประกาศกำหนดมาตรการช่วยเหลือลูกหนี้อย่างต่อเนื่อง โดยเน้นการแก้หนี้ระยะยาวและลดภาระดอกเบี้ย
ขอให้เจ้าหน้าที่ฝ่ายลูกค้าสัมพันธ์และพนักงานสาขาทำความเข้าใจแนวทางและหลักเกณฑ์ เพื่อสามารถให้คำแนะนำที่ถูกต้องแก่ลูกค้าที่ติดต่อเข้ามาได้อย่างมีประสิทธิภาพ`,
    category: 'bot-news',
    categoryLabel: 'BOT News',
    badge: 'BOT DIRECTIVE',
    badgeColor: 'blue',
    imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-08',
    author: 'ฝ่ายกำกับดูแลการปฏิบัติงาน (Regulatory Affairs)',
    department: 'Compliance',
    views: 1100,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'compliance'
  },
  {
    id: 'news-7',
    title: 'หลักเกณฑ์การกำกับธุรกิจการให้เช่าซื้อและการให้เช่าแบบลีสซิ่งรถยนต์และรถจักรยานยนต์ ฉบับที่ 2',
    titleEn: 'BOT Regulatory Guideline on Hire-Purchase & Leasing Businesses (Vol. 2)',
    summary: 'ข้อกำหนดและเพดานอัตราดอกเบี้ยใหม่ตามมาตรฐานการคุ้มครองผู้บริโภคของธนาคารแห่งประเทศไทย',
    content: `สรุปประเด็นสำคัญของหลักเกณฑ์ฉบับที่ 2 ที่มีผลบังคับใช้:
1. การกำหนดเพดานดอกเบี้ยแท้จริง (Effective Interest Rate)
2. สิทธิของลูกหนี้ในการชำระปิดบัญชีก่อนกำหนดพร้อมรับส่วนลดดอกเบี้ยตามอัตราส่วน
3. ข้อปฏิบัติในการทวงถามหนี้ที่เป็นธรรมตามกฎหมาย`,
    category: 'bot-news',
    categoryLabel: 'BOT News',
    badge: 'REGULATORY',
    badgeColor: 'blue',
    imageUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-04-18',
    author: 'ฝ่ายกำกับดูแลการปฏิบัติงาน (Regulatory Affairs)',
    department: 'Compliance',
    views: 790,
    syncToExternal: false,
    externalSyncStatus: 'draft'
  },
  {
    id: 'news-8',
    title: 'ประกาศคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (PDPA Update: หลักเกณฑ์การเข้าถึงและขอรับสำเนา)',
    titleEn: 'PDPA Compliance: Data Subject Rights & Handling Procedure',
    summary: 'แนวทางปฏิบัติตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 สำหรับเจ้าหน้าที่ผู้ดูแลข้อมูลลูกค้าและคู่ค้า',
    content: `พนักงานทุกท่านต้องปฏิบัติตามมาตรฐานการจัดเก็บและประมวลผลข้อมูลส่วนบุคคลอย่างเคร่งครัด
- ห้ามเปิดเผยข้อมูลลูกค้าแก่บุคคลภายนอกโดยไม่ได้รับความยินยอม
- กรณีลูกค้าใช้สิทธิ Data Subject Request (DSR) ให้ประสานงานมายังเจ้าหน้าที่ DPO ทันที
- จัดทำบันทึกรายการกิจกรรมการประมวลผล (RoPA) อย่างต่อเนื่อง`,
    category: 'regulation',
    categoryLabel: 'New Regulations',
    badge: 'PDPA UPDATE',
    badgeColor: 'emerald',
    imageUrl: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2025-05-02',
    author: 'เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (Data Protection Officer - DPO)',
    department: 'Legal & Privacy',
    views: 920,
    syncToExternal: true,
    externalSyncStatus: 'synced',
    externalCategory: 'compliance'
  }
];

export const INITIAL_BANNERS: BannerSlide[] = [
  {
    id: 'banner-kashjoy-hero',
    title: 'เรื่องเงินจบไว ไว้ใจ KASHJOY !',
    subtitle: 'ผู้ให้บริการสินเชื่อส่วนบุคคลจากประเทศเกาหลีใต้ ภายใต้การกำกับของธนาคารแห่งประเทศไทย วงเงินพร้อมใช้สูงสุด 5 เท่า',
    badge: 'KASHJOY EASY',
    imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    actionUrl: '#loans',
    actionText: 'ผลิตภัณฑ์สินเชื่อ Kashjoy',
    order: 1,
    isActive: true
  },
  {
    id: 'banner-1',
    title: 'Internal Phone Number & Directory',
    subtitle: 'ค้นหาเบอร์โทรศัพท์ภายใน แผนก และรายชื่อพนักงานได้สะดวกรวดเร็วตลอด 24 ชั่วโมง',
    badge: 'DIRECTORY',
    imageUrl: 'https://images.unsplash.com/photo-1534536281715-e28d76689b4d?auto=format&fit=crop&w=1200&q=80',
    actionUrl: '#directory',
    actionText: 'ค้นหาเบอร์ติดต่อภายใน',
    order: 2,
    isActive: true
  },
  {
    id: 'banner-2',
    title: 'Modernized Meeting Rooms Plan 2025',
    subtitle: 'ระบบจองห้องประชุมใหม่ 5 ห้อง ชั้น 14 และ 15 พร้อมอุปกรณ์ Video Conference เต็มรูปแบบ',
    badge: 'FACILITIES',
    imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
    actionUrl: '#meeting-rooms',
    actionText: 'ดูแผนผังและจองห้องประชุม',
    order: 2,
    isActive: true
  },
  {
    id: 'banner-3',
    title: 'KB J-E-DMS Electronic Document System',
    subtitle: 'ระบบบริหารจัดการเอกสารอิเล็กทรอนิกส์และลงนาม e-Signature ภายในองค์กร',
    badge: 'PAPERLESS',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    actionUrl: 'https://edms.kbjcapital.co.th',
    actionText: 'เข้าสู่ระบบ E-DMS',
    order: 3,
    isActive: true
  },
  {
    id: 'banner-4',
    title: 'KB J Capital Corporate Identity Guidelines',
    subtitle: 'ดาวน์โหลดคู่มือการใช้งานตราสัญลักษณ์และสีมาตรฐานองค์กร KB Gold และ Charcoal',
    badge: 'BRAND ASSETS',
    imageUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80',
    actionUrl: '#ci-guide',
    actionText: 'ดาวน์โหลด CI Guide',
    order: 4,
    isActive: true
  }
];

export const INITIAL_CONTACTS: DirectoryContact[] = [
  {
    id: 'dir-1',
    name: 'คุณวรวุฒิ เกียรติศิริ',
    nameEn: 'Worawut Kiatsiri',
    position: 'Chief Executive Officer (CEO)',
    department: 'Management',
    extension: '1001',
    directPhone: '02-009-9001',
    email: 'worawut.k@kbjcapital.co.th',
    floor: '15th Floor (Executive Wing)'
  },
  {
    id: 'dir-2',
    name: 'คุณคิม มินจู (Kim Min-Joo)',
    nameEn: 'Kim Min-Joo',
    position: 'Managing Director & Deputy CEO',
    department: 'Management',
    extension: '1002',
    directPhone: '02-009-9002',
    email: 'minjoo.kim@kbjcapital.co.th',
    floor: '15th Floor (Executive Wing)'
  },
  {
    id: 'dir-3',
    name: 'คุณกรรณิการ์ จิตเจริญ',
    nameEn: 'Kannikar Jitcharoen',
    position: 'Head of Human Resources',
    department: 'Human Resources',
    extension: '1201',
    directPhone: '02-009-9201',
    email: 'kannikar.j@kbjcapital.co.th',
    floor: '14th Floor (HR Section)'
  },
  {
    id: 'dir-4',
    name: 'คุณธนพล วงศ์สวัสดิ์',
    nameEn: 'Thanapol Wongsawat',
    position: 'IT Director & Systems Architect',
    department: 'Information Technology',
    extension: '1301',
    directPhone: '02-009-9301',
    email: 'thanapol.w@kbjcapital.co.th',
    floor: '14th Floor (IT Core Center)'
  },
  {
    id: 'dir-5',
    name: 'คุณประภาภรณ์ เลิศวิริยะ',
    nameEn: 'Prapaporn Lertviriya',
    position: 'IT Helpdesk & Support Lead',
    department: 'Information Technology',
    extension: '1305',
    directPhone: '02-009-9305',
    email: 'it-support@kbjcapital.co.th',
    floor: '14th Floor'
  },
  {
    id: 'dir-6',
    name: 'คุณชัชวาล รัตนพงษ์',
    nameEn: 'Chatchawan Rattanapong',
    position: 'Credit Risk Analysis Manager',
    department: 'Credit & Risk',
    extension: '1401',
    directPhone: '02-009-9401',
    email: 'chatchawan.r@kbjcapital.co.th',
    floor: '14th Floor'
  },
  {
    id: 'dir-7',
    name: 'คุณนภัสสร สุวรรณดี',
    nameEn: 'Napassorn Suwandee',
    position: 'Legal & Compliance Officer (DPO)',
    department: 'Compliance',
    extension: '1501',
    directPhone: '02-009-9501',
    email: 'compliance@kbjcapital.co.th',
    floor: '15th Floor'
  },
  {
    id: 'dir-8',
    name: 'คุณสมศักดิ์ ธรรมนูญ',
    nameEn: 'Somsak Thammanoon',
    position: 'General Affairs & Office Facilities',
    department: 'General Affairs',
    extension: '1100',
    directPhone: '02-009-9100',
    email: 'admin.ga@kbjcapital.co.th',
    floor: '14th Floor (Admin Reception)'
  }
];

export const INITIAL_MEETING_ROOMS: MeetingRoom[] = [
  {
    id: 'room-1',
    name: 'Kookmin Room',
    code: 'MR-1401',
    floor: '14th Floor',
    capacity: 20,
    facilities: ['Smart TV 75"', 'Cisco Webex Conference', 'Wireless Presentation', 'Whiteboard'],
    status: 'available'
  },
  {
    id: 'room-2',
    name: 'Jaymart Hall (Town Hall)',
    code: 'MR-1402',
    floor: '14th Floor',
    capacity: 45,
    facilities: ['Dual Projectors', 'Wireless Mic System', 'Zoom Rooms', 'Live Streaming Deck'],
    status: 'in-use',
    currentBooking: {
      topic: 'Monthly Business Review (MBR Q2)',
      booker: 'Corporate Strategy Team',
      time: '13:30 - 15:30'
    }
  },
  {
    id: 'room-3',
    name: 'Sukhumvit Room',
    code: 'MR-1403',
    floor: '14th Floor',
    capacity: 10,
    facilities: ['Interactive Touch Screen 65"', 'High-speed LAN', 'Whiteboard'],
    status: 'available'
  },
  {
    id: 'room-4',
    name: 'Han River Room (Seoul Link)',
    code: 'MR-1501',
    floor: '15th Floor',
    capacity: 12,
    facilities: ['Dedicated 4K Video Link to Seoul', 'Noise-canceling Array', 'Executive Seating'],
    status: 'available'
  },
  {
    id: 'room-5',
    name: 'Chao Phraya Room',
    code: 'MR-1502',
    floor: '15th Floor',
    capacity: 8,
    facilities: ['Display Monitor 55"', 'Speakerphone', 'Coffee Counter Access'],
    status: 'available'
  }
];

export const INITIAL_ROOMS: MeetingRoom[] = INITIAL_MEETING_ROOMS;

export const INITIAL_DOCUMENTS: PolicyDocument[] = [
  {
    id: 'doc-1',
    title: 'จรรยาบรรณในการดำเนินธุรกิจ (Code of Business Conduct & Ethics)',
    titleEn: 'Code of Business Conduct & Ethics 2025',
    category: 'governance',
    department: 'Compliance',
    version: 'v3.2 (2025)',
    updatedAt: '2025-01-15',
    fileSize: '2.4 MB',
    downloadUrl: '#download-code-of-conduct'
  },
  {
    id: 'doc-2',
    title: 'ข้อบังคับเกี่ยวกับการทำงาน พ.ศ. 2568 (Company Work Rules)',
    titleEn: 'Company Work Rules & Regulations 2025',
    category: 'work-rules',
    department: 'Human Resources',
    version: 'v4.0',
    updatedAt: '2025-02-01',
    fileSize: '3.8 MB',
    downloadUrl: '#download-work-rules',
    isNew: true
  },
  {
    id: 'doc-3',
    title: 'นโยบายการคุ้มครองข้อมูลส่วนบุคคล (Company Privacy Policy & PDPA)',
    titleEn: 'Personal Data Protection Policy (PDPA)',
    category: 'policy',
    department: 'Legal',
    version: 'v2.1',
    updatedAt: '2025-03-10',
    fileSize: '1.9 MB',
    downloadUrl: '#download-pdpa-policy'
  },
  {
    id: 'doc-4',
    title: 'คู่มือพนักงาน เคบี เจ แคปปิตอล (Employee Onboarding Handbook)',
    titleEn: 'KB J Capital Employee Handbook',
    category: 'handbook',
    department: 'Human Resources',
    version: 'v5.0',
    updatedAt: '2025-04-05',
    fileSize: '5.2 MB',
    downloadUrl: '#download-handbook'
  },
  {
    id: 'doc-5',
    title: 'แบบฟอร์มขออนุมัติเบิกค่ารักษาพยาบาล (Medical Claim Form)',
    titleEn: 'Medical Expense Claim Form (OPD / IPD)',
    category: 'form',
    department: 'Human Resources',
    version: 'Form HR-003 Rev.6',
    updatedAt: '2025-01-20',
    fileSize: '450 KB',
    downloadUrl: '#download-form-medical'
  },
  {
    id: 'doc-6',
    title: 'แบบฟอร์มขอใช้สิทธิ์เข้าถึงระบบ IT และอุปกรณ์ (IT Access & Asset Request)',
    titleEn: 'IT Access & Hardware Requisition Form',
    category: 'form',
    department: 'Information Technology',
    version: 'Form IT-001 Rev.4',
    updatedAt: '2025-02-14',
    fileSize: '380 KB',
    downloadUrl: '#download-form-it'
  },
  {
    id: 'doc-7',
    title: 'แบบฟอร์มขออนุมัติทำงานนอกสถานที่ (Work From Anywhere Request Form)',
    titleEn: 'Work From Anywhere (WFA) Approval Request',
    category: 'form',
    department: 'Human Resources',
    version: 'Form HR-012 Rev.2',
    updatedAt: '2025-03-01',
    fileSize: '290 KB',
    downloadUrl: '#download-form-wfa'
  }
];

export const INITIAL_TOOLS: SystemTool[] = [
  {
    id: 'tool-hr',
    name: 'HR System',
    description: 'บันทึกเวลาทำงาน ลางาน ดูสลิปเงินเดือน (e-Payslip) และสวัสดิการ',
    iconName: 'Users',
    url: 'https://hr.kbjcapital.co.th',
    category: 'hr',
    color: 'from-amber-500 to-amber-600'
  },
  {
    id: 'tool-it',
    name: 'IT-Request',
    description: 'เปิด Ticket แจ้งปัญหาคอมพิวเตอร์ อินเทอร์เน็ต และขอสิทธิ์ระบบ',
    iconName: 'Laptop',
    url: 'https://it-service.kbjcapital.co.th',
    category: 'it',
    color: 'from-slate-700 to-slate-900'
  },
  {
    id: 'tool-edms',
    name: 'KB J-E-DMS',
    description: 'ระบบสารบรรณและลงนามเอกสารอิเล็กทรอนิกส์ (Paperless Portal)',
    iconName: 'FileCheck',
    url: 'https://edms.kbjcapital.co.th',
    category: 'business',
    color: 'from-blue-600 to-blue-700'
  },
  {
    id: 'tool-rooms',
    name: 'Meeting Room Booking',
    description: 'ตรวจเช็คสถานะและจองห้องประชุมชั้น 14-15 พร้อมระบบประชุมทางไกล',
    iconName: 'CalendarDays',
    url: '#meeting-rooms',
    category: 'general',
    color: 'from-emerald-600 to-emerald-700'
  },
  {
    id: 'tool-kashjoy',
    name: 'Kashjoy Core Portal',
    description: 'ระบบแกนบริการสินเชื่อส่วนบุคคล สินเชื่อจำนำทะเบียน และผ่อนชำระ',
    iconName: 'CreditCard',
    url: 'https://kashjoy.kbjcapital.co.th',
    category: 'business',
    isExternal: true,
    color: 'from-amber-600 to-yellow-600'
  },
  {
    id: 'tool-public',
    name: 'Public Website (www.kbjcapital.co.th)',
    description: 'พอร์ทัลเว็บไซต์ภายนอกสำหรับลูกค้ารายย่อยและสาธารณชน',
    iconName: 'Globe',
    url: 'https://www.kbjcapital.co.th',
    category: 'general',
    isExternal: true,
    color: 'from-sky-600 to-blue-800'
  }
];

export const INITIAL_SYNC_LOGS: SyncLog[] = [
  {
    id: 'sync-1',
    timestamp: '2025-05-18 10:15:22',
    itemId: 'news-3',
    itemTitle: 'Update New Logo! คู่มือการใช้งานโลโก้และ CI บริษัท',
    action: 'UPDATE',
    status: 'SUCCESS',
    targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
    syncedBy: 'admin.marketing@kbjcapital.co.th'
  },
  {
    id: 'sync-2',
    timestamp: '2025-05-15 14:20:05',
    itemId: 'news-4',
    itemTitle: 'โครงการ "ปิดหนี้ไว ไปต่อได้" ร่วมกับ NCB',
    action: 'CREATE',
    status: 'SUCCESS',
    targetEndpoint: 'api.kbjcapital.co.th/v1/public/announcements',
    syncedBy: 'admin.compliance@kbjcapital.co.th'
  },
  {
    id: 'sync-3',
    timestamp: '2025-05-12 09:44:11',
    itemId: 'news-6',
    itemTitle: 'ธปท. ประกาศมาตรการช่วยเหลือลูกหนี้ "คุณสู้ เราช่วย"',
    action: 'UPDATE',
    status: 'SUCCESS',
    targetEndpoint: 'api.kbjcapital.co.th/v1/public/notices',
    syncedBy: 'admin.compliance@kbjcapital.co.th'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-1',
    timestamp: '2026-08-01 10:15:20',
    actor: 'admin.fraud@kbjcapital.co.th',
    actorRole: 'Checker (VP Risk)',
    action: 'APPROVE',
    targetResource: 'News Announcement',
    resourceId: 'news-fraud-alert',
    details: 'Approved anti-fraud advisory broadcast for all staff & external portal.',
    ipAddress: '10.14.22.84 (Corporate Sindhorn)',
    status: 'SUCCESS',
  },
  {
    id: 'audit-2',
    timestamp: '2026-08-01 09:40:12',
    actor: 'maker.comms@kbjcapital.co.th',
    actorRole: 'Maker (Corporate Comms)',
    action: 'SUBMIT_APPROVAL',
    targetResource: 'News Announcement',
    resourceId: 'news-fraud-alert',
    details: 'Submitted fraud alert for Dual-Approval before public web synchronization.',
    ipAddress: '10.14.22.105',
    status: 'SUCCESS',
  },
  {
    id: 'audit-3',
    timestamp: '2026-07-28 16:30:00',
    actor: 'hr.admin@kbjcapital.co.th',
    actorRole: 'Maker (HR)',
    action: 'UPDATE',
    targetResource: 'Policy Document',
    resourceId: 'doc-1',
    details: 'Updated Employee Code of Conduct & PDPA Guidelines (v2.4).',
    ipAddress: '10.14.22.45',
    status: 'SUCCESS',
  },
  {
    id: 'audit-4',
    timestamp: '2026-07-25 11:22:18',
    actor: 'it.secops@kbjcapital.co.th',
    actorRole: 'Security Officer',
    action: 'SYNC_TRIGGER',
    targetResource: 'Public Edge Gateway',
    resourceId: 'GATEWAY-HANDSHAKE',
    details: 'Purged public edge cache and verified CDN certificate validity.',
    ipAddress: '10.14.1.2',
    status: 'SUCCESS',
  },
];

