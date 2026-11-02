export type VideoEmbedData = {
  embedUrl: string;
  watchUrl: string;
  videoType: "youtube" | "html5" | "search";
  videoId?: string;
  formCues: {
    setup: string[];
    execution: string[];
    mistakes: string[];
  };
};

/**
 * Extracts YouTube video ID from various YouTube URL formats
 * (e.g. watch?v=..., youtu.be/..., embed/..., shorts/...)
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim();

  // youtube.com/watch?v=ID or &v=ID
  const watchMatch = cleaned.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch?.[1]) return watchMatch[1];

  // youtu.be/ID
  const shortMatch = cleaned.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch?.[1]) return shortMatch[1];

  // youtube.com/embed/ID
  const embedMatch = cleaned.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch?.[1]) return embedMatch[1];

  // youtube.com/shorts/ID
  const shortsMatch = cleaned.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch?.[1]) return shortsMatch[1];

  return null;
}

/**
 * Normalizes an exercise name into a hyphenated slug for tutorial lookup
 */
export function exerciseNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Normalizes an exercise name ignoring parentheses
 */
export function exerciseNameToBaseSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Curated dictionary of verified fitness tutorial video IDs and technique cues
 * for all 120 exercises in the catalog.
 */
export const CURATED_TUTORIALS: Record<
  string,
  {
    videoId: string;
    setup: string[];
    execution: string[];
    mistakes: string[];
  }
> = {
  "bench-press": {
    videoId: "rT7DgCr-3pg",
    setup: ["Berbaring dengan mata tepat di bawah bar","Kunci belikat (retract & depress scapula) dan tapakkan kaki kokoh ke lantai","Genggam bar sedikit lebih lebar dari bahu"],
    execution: ["Tarik napas, turunkan bar terkontrol ke dada tengah/bawah (sudut siku ~45°)","Sentuh dada perlahan tanpa memantulkan beban","Dorong bar ke atas secara eksplosif sambil menghembuskan napas"],
    mistakes: ["Siku membuka 90° lebar (risiko cedera bahu)","Punggung terlalu melengkung berlebihan","Beban dipantulkan dari dada"],
  },
  "incline-barbell-bench-press": {
    videoId: "SrqOu55lrYU",
    setup: ["Setel bangku ke kemiringan 30–45 derajat","Kunci belikat ke sandaran bangku","Kaki menapak kuat di lantai"],
    execution: ["Turunkan bar perlahan ke dada bagian atas (di bawah tulang selangka)","Dorong lurus ke atas hingga lengan hampir lurus"],
    mistakes: ["Kemiringan bangku terlalu tegak (beban beralih ke bahu)","Siku melebar keluar 90 derajat"],
  },
  "incline-dumbbell-press": {
    videoId: "8iPEnn-ltC8",
    setup: ["Kemiringan bangku 30–45 derajat","Tarik bahu ke belakang dan busungkan dada","Angkat dumbbell dengan bantuan lutut"],
    execution: ["Turunkan dumbbell hingga setinggi dada samping","Dorong dumbbell ke atas membentuk busur halus tanpa saling membentur"],
    mistakes: ["Membenturkan dumbbell di puncak gerakan","Menurunkan dumbbell terlalu cepat tanpa kontrol"],
  },
  "incline-dumbbell-fly": {
    videoId: "bDaIL_zKbGs",
    setup: ["Bangku miring 30 derajat, busungkan dada","Pegang dumbbell di atas dada dengan siku sedikit menekuk"],
    execution: ["Buka lengan ke samping membentuk lengkungan lebar hingga dada teregang nyaman","Bawa kembali ke atas dengan gerakan memeluk"],
    mistakes: ["Menekuk siku terlalu dalam (berubah jadi press)","Menurunkan beban terlalu rendah melebihi fleksibilitas bahu"],
  },
  "dumbbell-floor-press": {
    videoId: "uUGDRwge4F8",
    setup: ["Berbaring di lantai dengan lutut ditekuk dan telapak kaki menapak","Pegang dumbbell di atas dada"],
    execution: ["Turunkan dumbbell hingga lengan atas menyentuh lantai dengan lembut","Jeda sejenak tanpa melepas tegangan otot, lalu dorong kembali ke atas"],
    mistakes: ["Membanting siku ke lantai","Pinggul terangkat dari lantai saat mendorong"],
  },
  "push-up": {
    videoId: "IODxDxX7oi4",
    setup: ["Tangan sedikit lebih lebar dari bahu","Tubuh lurus dari kepala hingga tumit (kunci core & glutes)"],
    execution: ["Turunkan badan hingga dada hampir menyentuh lantai (sudut siku 45°)","Dorong lantai menjauh hingga kembali ke posisi awal"],
    mistakes: ["Pinggul turun ke bawah (sagging)","Leher ditekuk ke bawah menatap kaki"],
  },
  "incline-push-up": {
    videoId: "-9S9gdRwwak",
    setup: ["Posisikan kedua telapak tangan di atas bangku, boks, atau platform tinggi","Tubuh lurus dari tumit hingga kepala dengan core terkunci"],
    execution: ["Turunkan dada perlahan ke arah tepi bangku dengan siku menyudut ~45°","Dorong kuat platform hingga lengan kembali lurus"],
    mistakes: ["Pinggang melorot ke bawah","Siku membuka terlalu lebar ke samping"],
  },
  "diamond-push-up": {
    videoId: "J0DnG1_S92I",
    setup: ["Bentuk segitiga/diamond dengan kedua ibu jari dan telunjuk saling bersentuhan di lantai","Kaki rapat atau selebar bahu"],
    execution: ["Turunkan dada ke arah pusat tangan diamond dengan siku tetap dekat ke rusuk","Dorong lantai dengan fokus kontraksi triceps"],
    mistakes: ["Siku melebar ke samping secara berlebihan","Menekuk pinggang"],
  },
  "wide-grip-push-up": {
    videoId: "rr6eFNNDQxE",
    setup: ["Tempatkan tangan di lantai dengan jarak lebih lebar dari bahu (sekitar 1.5x lebar bahu)","Kunci core"],
    execution: ["Turunkan dada secara terkontrol ke arah lantai","Rasakan regangan pada otot dada luar dan dorong kembali ke atas"],
    mistakes: ["Menurunkan bahu lebih cepat daripada dada","Punggung bawah melengkung"],
  },
  "chest-dips": {
    videoId: "2z8JmcrW-As",
    setup: ["Genggam bar paralel, condongkan tubuh ke depan sekitar 20–30 derajat","Tekuk lutut sedikit dan silangkan kaki"],
    execution: ["Turunkan badan hingga sudut siku mencapai 90 derajat sambil menjaga badan tetap condong ke depan","Dorong kembali ke atas dengan kontraksi dada bawah"],
    mistakes: ["Tubuh terlalu tegak (fokus beralih ke tricep)","Turun terlalu dalam hingga meregangkan kapsul bahu secara berlebihan"],
  },
  "cable-chest-fly": {
    videoId: "Iwe6AmxVf7o",
    setup: ["Pasang katrol kabel setinggi dada atau sedikit di atasnya","Maju satu langkah ke depan dalam posisi lunge untuk stabilitas"],
    execution: ["Bawa kedua handle kabel ke depan dada seperti memeluk pohon besar","Tahan kontraksi 1 detik di puncak, buka kembali perlahan"],
    mistakes: ["Mengayunkan badan menggunakan momentum","Siku lurus total atau terlalu ditekuk"],
  },
  "cable-crossover": {
    videoId: "taI4XduLpTk",
    setup: ["Katrol di posisi paling atas, ambil pegangan dan melangkah ke depan","Condongkan tubuh sedikit ke depan dari pinggul"],
    execution: ["Tarik kabel menyilang ke arah bawah di depan pinggul","Remas otot dada bawah di akhir gerakan"],
    mistakes: ["Bahu terangkat ke arah telinga","Menurunkan beban tanpa kontrol eksentrik"],
  },
  "pec-deck-machine": {
    videoId: "O-OnnvyS8rE",
    setup: ["Atur tinggi kursi hingga pegangan setinggi dada tengah","Punggung dan kepala menempel pada sandaran"],
    execution: ["Rapatkan pegangan di depan dada dengan gerakan melengkung halus","Buka kembali perlahan hingga dada terasa teregang"],
    mistakes: ["Bahu maju ke depan saat merapatkan pegangan","Menggunakan beban yang membatasi rentang gerak penuh"],
  },
  "machine-chest-press": {
    videoId: "xUm0BiZCWlQ",
    setup: ["Atur tinggi dudukan sehingga handle sejajar dengan garis puting dada","Kunci belikat ke sandaran kursi"],
    execution: ["Dorong pegangan ke depan hingga lengan hampir lurus tanpa mengunci sendi siku","Kembalikan beban perlahan ke posisi awal"],
    mistakes: ["Bahu terlepas ke depan dari sandaran di akhir dorongan","Tempo terlalu terburu-buru"],
  },
  "close-grip-barbell-bench-press": {
    videoId: "nEF0bv2FW94",
    setup: ["Genggam bar dengan jarak selebar bahu (hindari terlalu sempit agar pergelangan tangan aman)","Kaki menapak stabil di lantai"],
    execution: ["Turunkan bar ke dada bawah sambil menjaga siku tetap rapat ke rusuk","Dorong bar ke atas dengan fokus utama dorongan triceps"],
    mistakes: ["Genggaman terlalu sempit (<15 cm) yang mencederai pergelangan","Siku melebar keluar"],
  },
  "triceps-pushdown": {
    videoId: "2-LAMcpzODU",
    setup: ["Pasang bar lurus atau V-bar di kabel tinggi","Berdiri tegak sedikit condong ke depan, siku rapat di samping pinggang"],
    execution: ["Dorong bar ke bawah hingga lengan lurus penuh dan triceps terkontraksi maksimal","Kembalikan ke sudut 90° tanpa menggerakkan siku"],
    mistakes: ["Siku bergerak maju mundur","Menggunakan berat badan untuk menekan beban"],
  },
  "tricep-rope-pushdown": {
    videoId: "vB5OHsJ3EME",
    setup: ["Pasang tali (rope) di katrol atas","Pegang tali dengan telapak tangan saling berhadapan, siku rapat di rusuk"],
    execution: ["Tarik tali ke bawah dan bentangkan kedua ujung tali ke samping di bagian bawah untuk kontraksi ekstra","Kembalikan perlahan ke posisi awal"],
    mistakes: ["Siku terangkat ke depan saat gerakan naik","Mengayunkan punggung"],
  },
  "single-arm-cable-tricep-pushdown": {
    videoId: "2-LAMcpzODU",
    setup: ["Gunakan pegangan single-handle atau pegang langsung ujung kabel tanpa handle","Kunci siku di samping tubuh"],
    execution: ["Luruskan lengan ke bawah secara unilateral dan rasakan kontraksi penuh pada kepala lateral triceps","Kembalikan perlahan dengan tempo 2-3 detik"],
    mistakes: ["Bahu memutar saat mendorong","Mengayunkan lengan atas"],
  },
  "cable-tricep-kickback": {
    videoId: "2-LAMcpzODU",
    setup: ["Atur katrol kabel setinggi lutut/paha","Condongkan tubuh ke depan, posisikan lengan atas sejajar lantai"],
    execution: ["Luruskan siku ke belakang hingga lengan terkunci lurus","Tahan kontraksi 1 detik di puncak, lalu kembalikan ke sudut 90°"],
    mistakes: ["Lengan atas turun dari posisi sejajar lantai","Mengayunkan kabel"],
  },
  "dumbbell-tricep-kickback": {
    videoId: "6SS6KTAmvNE",
    setup: ["Satu lutut dan satu tangan bertumpu di bangku, atau berdiri membungkuk","Kunci lengan atas sejajar dengan tubuh"],
    execution: ["Dorong dumbbell ke belakang hanya dengan menggerakkan lengan bawah hingga lengan lurus","Tahan kontraksi sejenak"],
    mistakes: ["Lengan atas bergoyang naik turun","Menggunakan momentum lemparan beban"],
  },
  "skull-crusher": {
    videoId: "d_KZxkY_0cM",
    setup: ["Berbaring di bangku datar dengan memegang EZ-bar di atas dahi","Lengan sedikit condong ke arah kepala (~10°) agar tegangan tetap ada"],
    execution: ["Tekuk siku perlahan, turunkan bar ke arah puncak kepala/dahi","Luruskan kembali lengan ke posisi awal menggunakan triceps"],
    mistakes: ["Siku melebar ke samping","Lengan atas bergerak maju mundur seperti gerakan pullovers"],
  },
  "overhead-dumbbell-triceps-extension": {
    videoId: "_gsUck-7M74",
    setup: ["Duduk tegak, pegang dumbbell dengan kedua tangan membentuk mangkuk di bawah piringan atas","Posisikan beban di atas kepala"],
    execution: ["Turunkan dumbbell ke belakang kepala dengan menekuk siku hingga teregang penuh","Dorong kembali ke atas hingga lengan lurus"],
    mistakes: ["Siku membuka terlalu lebar","Tulang belakang bawah melengkung berlebihan (kunci perut)"],
  },
  "overhead-cable-triceps-extension": {
    videoId: "1u18yJcLuh0",
    setup: ["Pasang tali di katrol kabel setinggi bahu atau dada","Maju membelakangi katrol, bawa tali di atas kepala dengan siku ditekuk"],
    execution: ["Dorong tali ke depan dan ke atas hingga lengan lurus, pisahkan ujung tali di puncak gerakan","Kembalikan secara terkontrol"],
    mistakes: ["Siku bergerak ke luar dan ke dalam secara liar","Punggung membungkuk"],
  },
  "overhead-ez-bar-french-press": {
    videoId: "fJzZvd7F9w8",
    setup: ["Duduk tegak dengan sandaran punggung rendah jika ada, pegang EZ-bar di atas kepala","Siku mengarah ke depan"],
    execution: ["Turunkan bar ke belakang leher secara terkontrol","Dorong kembali ke atas menggunakan kontraksi kepala panjang triceps"],
    mistakes: ["Menurunkan bar terlalu cepat mengenai leher","Siku melebar ke samping"],
  },
  "chair-bench-dips": {
    videoId: "0326dy_-CzM",
    setup: ["Duduk di tepi bangku/kursi kokoh, letakkan tangan di samping pinggul","Geser bokong ke depan keluar dari bangku dengan kaki di lantai"],
    execution: ["Turunkan pinggul mendekati lantai dengan menekuk siku hingga sudut 90 derajat","Dorong kembali ke atas menggunakan triceps"],
    mistakes: ["Pinggul menjauh terlalu jauh dari bangku (menekan sendi bahu)","Turun terlalu dalam melebihi 90 derajat"],
  },
  "parallel-bar-dips": {
    videoId: "2z8JmcrW-As",
    setup: ["Posisikan tubuh tegak di atas palang paralel","Jaga postur badan tetap vertikal untuk memfokuskan beban pada triceps"],
    execution: ["Turunkan tubuh dengan siku menekuk ke belakang hingga sudut 90 derajat","Dorong kuat ke atas hingga lengan terkunci"],
    mistakes: ["Terlalu condong ke depan (akan lebih melatih dada)","Gerakan setengah-setengah (half reps)"],
  },
  "back-squat": {
    videoId: "bEv6CCg2BC8",
    setup: ["Letakkan bar di atas trapezius (high bar) atau posterior delt (low bar)","Buka kaki selebar bahu, ujung jari kaki sedikit mengarah ke luar (15–30°)"],
    execution: ["Tarik napas, dorong pinggul ke belakang dan tekuk lutut bersamaan","Turun hingga paha minimal sejajar lantai (lutut searah jari kaki)","Dorong lantai melalui seluruh telapak kaki untuk berdiri tegak"],
    mistakes: ["Lutut menekuk ke dalam (knee valgus)","Tumit terangkat dari lantai","Punggung membungkuk"],
  },
  "front-squat": {
    videoId: "v-mQm_droHg",
    setup: ["Letakkan bar di anterior deltoid dengan siku terangkat tinggi sejajar lantai","Dada tegak lurus"],
    execution: ["Turunkan badan secara vertikal dengan menjaga siku tetap tinggi","Dorong tegak kembali ke atas"],
    mistakes: ["Siku turun ke bawah menyebabkan bar tergelincir","Tubuh condong terlalu jauh ke depan"],
  },
  "goblet-squat": {
    videoId: "MeIiIdhvXT4",
    setup: ["Pegang dumbbell atau kettlebell rapat di depan dada","Kaki selebar bahu"],
    execution: ["Jongkok dengan dada tegak hingga siku menyentuh bagian dalam lutut","Dorong kembali ke posisi berdiri"],
    mistakes: ["Beban menjauh dari dada","Punggung bawah membungkuk"],
  },
  "hack-squat": {
    videoId: "0tn5K9NlCfo",
    setup: ["Posisikan punggung rata pada bantalan mesin hack squat","Kaki di tengah platform selebar bahu"],
    execution: ["Buka pengunci, turunkan beban terkontrol hingga sudut lutut 90 derajat","Dorong kuat melalui tumit dan telapak kaki"],
    mistakes: ["Mengunci lutut secara kasar di puncak (hyperextension)","Tumit terangkat dari platform"],
  },
  "bulgarian-split-squat": {
    videoId: "2C-uNgKwPLE",
    setup: ["Letakkan satu kaki di belakang di atas bangku, satu kaki di depan","Pegang dumbbell di samping badan"],
    execution: ["Turunkan lutut belakang mendekati lantai dengan badan sedikit condong ke depan","Dorong melalui tumit kaki depan untuk kembali naik"],
    mistakes: ["Langkah terlalu pendek menyebabkan lutut depan tertekan","Badan terlalu tegak kaku"],
  },
  "air-squats": {
    videoId: "C_VtOYc6j5c",
    setup: ["Berdiri dengan kaki selebar bahu, jari kaki sedikit menyerong keluar","Tangan di depan dada atau lurus ke depan untuk keseimbangan"],
    execution: ["Dorong pinggul ke belakang dan tekuk lutut hingga paha sejajar lantai","Dorong telapak kaki untuk kembali berdiri tegak"],
    mistakes: ["Tumit terangkat saat jongkok","Punggung membungkuk ke depan"],
  },
  "leg-press": {
    videoId: "IZxyjW7MPJQ",
    setup: ["Duduk di mesin leg press dengan punggung dan pinggul menempel rapat pada sandaran","Tempatkan kaki di tengah platform selebar bahu"],
    execution: ["Lepaskan pengaman, turunkan platform secara terkontrol hingga lutut membentuk sudut 90 derajat","Dorong platform kembali ke atas tanpa mengunci sendi lutut total"],
    mistakes: ["Mengunci sendi lutut secara keras di puncak","Bokong dan pinggang bawah terangkat dari sandaran kursi"],
  },
  "leg-extension": {
    videoId: "YyvSfVjQeL0",
    setup: ["Atur bantalan tepat di atas pergelangan kaki","Punggung menempel penuh ke sandaran"],
    execution: ["Luruskan kaki ke atas dengan kontraksi penuh paha depan","Turunkan beban perlahan (2 detik) tanpa menyentuh tumpukan beban"],
    mistakes: ["Mengayunkan badan menggunakan momentum","Beban dilepas jatuh begitu saja"],
  },
  "lying-leg-curl": {
    videoId: "1Tq3QdYUuHs",
    setup: ["Berbaring tengkurap dengan bantalan di belakang pergelangan kaki","Pegang pegangan mesin untuk menjaga pinggul tetap menempel"],
    execution: ["Tarik tumit ke arah bokong dengan mengontraksikan hamstring","Turunkan beban secara terkontrol"],
    mistakes: ["Pinggul terangkat dari bantalan saat menarik beban","Gerakan terlalu cepat dan menyentak"],
  },
  "seated-leg-curl": {
    videoId: "ELOCsoDSmrg",
    setup: ["Duduk dengan punggung rata pada sandaran","Kunci bantalan paha atas dengan pas di atas lutut, bantalan bawah tepat di bawah betis"],
    execution: ["Tekuk kaki ke bawah ke arah belakang dengan kontraksi hamstring","Kembalikan secara perlahan ke atas"],
    mistakes: ["Bantalan paha terlalu longgar sehingga tubuh bergeser","Menendang beban dengan hentakan"],
  },
  "hip-thrust": {
    videoId: "SEdqd1n0cvg",
    setup: ["Punggung atas bersandar pada bangku, bar dengan bantalan di lipatan pinggul","Kaki ditekuk 90 derajat saat pinggul di atas"],
    execution: ["Dorong pinggul ke atas hingga tubuh lurus dari bahu ke lutut","Tahan kontraksi glutes 1 detik di puncak","Turunkan terkontrol"],
    mistakes: ["Melengkungkan tulang belakang bawah (gunakan rotasi pinggul)","Kepala mendongak ke belakang alih-alih pandangan ke depan"],
  },
  "glute-bridge": {
    videoId: "wPM8icPu6H8",
    setup: ["Berbaring telentang di matras dengan lutut ditekuk dan telapak kaki menapak di lantai selebar pinggul","Lengan di samping tubuh"],
    execution: ["Dorong tumit ke lantai dan angkat pinggul hingga tubuh lurus dari lutut ke bahu","Remas glutes di puncak selama 1–2 detik, lalu turunkan perlahan"],
    mistakes: ["Mendorong menggunakan pinggang bawah alih-alih glutes","Kaki diletakkan terlalu jauh ke depan"],
  },
  "walking-lunge": {
    videoId: "L8fvypPrzzs",
    setup: ["Berdiri tegak dengan kaki selebar pinggul, pegang dumbbell di samping tubuh jika menggunakan beban"],
    execution: ["Melangkah maju satu langkah panjang, turunkan pinggul hingga kedua lutut membentuk sudut 90 derajat","Dorong kaki depan untuk melangkah langsung ke depan dengan kaki berikutnya"],
    mistakes: ["Lutut depan melesat terlalu jauh melampaui jari kaki","Tubuh terhuyung-huyung kehilangan keseimbangan"],
  },
  "wall-sit": {
    videoId: "y-wV4Venusw",
    setup: ["Sandarkan punggung rata pada dinding","Geser kaki ke depan hingga lutut menekuk 90 derajat sejajar paha"],
    execution: ["Tahan posisi jongkok ini dengan seluruh punggung menempel rata pada dinding","Bernapas stabil dan tahan sesuai target durasi"],
    mistakes: ["Meletakkan tangan di atas paha untuk menopang beban","Paha tidak sejajar dengan lantai (terlalu tinggi)"],
  },
  "seated-calf-raise": {
    videoId: "JbyjNymZOt0",
    setup: ["Duduk di mesin dengan bantalan di atas paha bawah dekat lutut","Ujung kaki berada di tepi platform"],
    execution: ["Turunkan tumit sejauh mungkin untuk peregangan penuh soleus","Dorong ujung kaki ke atas setinggi mungkin dan tahan kontraksi 1 detik"],
    mistakes: ["Memantul-mantulkan beban di bagian bawah","Rentang gerak terpotong (tidak jinjit penuh)"],
  },
  "standing-machine-calf-raise": {
    videoId: "3UWi44yN-wE",
    setup: ["Posisikan bantalan bahu di atas pundak, berdiri tegak dengan ujung kaki di tepi platform","Lutut sedikit terbuka tidak terkunci kaku"],
    execution: ["Turunkan tumit ke bawah hingga betis teregang maksimal","Jinjit ke atas setinggi mungkin melalui pangkal ibu jari kaki"],
    mistakes: ["Menekuk lutut untuk mengayunkan beban","Tempo terlalu cepat tanpa jeda di puncak kontraksi"],
  },
  "single-leg-calf-raise": {
    videoId: "JbyjNymZOt0",
    setup: ["Berdiri pada satu kaki di tepi anak tangga atau platform, pegang dinding untuk keseimbangan","Kaki lainnya ditekuk"],
    execution: ["Turunkan tumit ke bawah sejauh mungkin, lalu jinjit kuat ke atas","Tahan kontraksi 1 detik di puncak gerakan"],
    mistakes: ["Mengandalkan dorongan tangan penyeimbang","Rentang gerak tidak penuh"],
  },
  "hip-abduction-machine": {
    videoId: "G_8L9u1xLrk",
    setup: ["Duduk di mesin abduction dengan bantalan berada di sisi luar lutut/paha","Punggung menempel pada sandaran"],
    execution: ["Buka kedua paha ke arah luar selebar mungkin melawan resistensi beban","Tahan sejenak di luar, lalu kembalikan perlahan ke posisi awal"],
    mistakes: ["Menggunakan momentum sentakan tubuh","Melepaskan beban tanpa kontrol di fase negatif"],
  },
  "hip-adduction-machine": {
    videoId: "e_p5a_QjQO4",
    setup: ["Duduk di mesin adduction dengan bantalan di sisi dalam lutut","Buka kedua kaki lebar pada posisi awal"],
    execution: ["Rapatkan kedua kaki ke arah dalam menggunakan kekuatan otot selangkangan (adductors)","Tahan 1 detik di tengah, lalu buka kembali perlahan"],
    mistakes: ["Beban terlalu berat hingga memicu tarikan otot paha dalam","Gerakan terlalu tergesa-gesa"],
  },
  "deadlift": {
    videoId: "op9kVnSso6Q",
    setup: ["Kaki selebar pinggul, bar di atas pertengahan telapak kaki (midfoot)","Raih bar tanpa memindahkan posisi bar","Dorong tulang kering ke bar dan busungkan dada"],
    execution: ["Tarik napas dalam, kencangkan latissimus dorsi","Dorong lantai menjauh dengan kaki hingga bar melewati lutut, lalu kunci pinggul","Kembalikan bar ke lantai dengan mendorong pinggul ke belakang terlebih dahulu"],
    mistakes: ["Punggung bawah melengkung (rounded spine)","Bar menjauh dari tubuh","Menghentak bar sebelum beban siap"],
  },
  "romanian-deadlift": {
    videoId: "JCXUYuzwNrM",
    setup: ["Pegang bar atau dumbbell di depan paha dengan genggaman selebar bahu","Lutut sedikit ditekuk (soft knees) dan terkunci pada sudut tersebut"],
    execution: ["Dorong pinggul ke belakang sejauh mungkin sambil menjaga punggung tetap lurus","Turunkan beban tepat di bawah lutut hingga hamstring teregang penuh","Dorong pinggul ke depan untuk kembali berdiri tegak"],
    mistakes: ["Menekuk lutut lebih banyak (menjadi squat)","Punggung membungkuk di bagian bawah gerakan"],
  },
  "sumo-deadlift": {
    videoId: "wbhTqvyiO28",
    setup: ["Buka kaki sangat lebar mendekati piringan beban, jari kaki menyerong 45 derajat ke luar","Genggam bar tepat di dalam kedua lutut selebar bahu"],
    execution: ["Buka lutut ke arah jari kaki dan buka dada tegak","Dorong lantai ke samping dan kencangkan glutes saat berdiri tegak"],
    mistakes: ["Pinggul terangkat lebih awal dari dada","Lutut kolaps ke dalam saat mulai mengangkat"],
  },
  "deficit-deadlift": {
    videoId: "q6t8pU2UuL8",
    setup: ["Berdiri di atas piringan beban atau platform setinggi 2–5 cm","Posisikan bar di atas pertengahan kaki"],
    execution: ["Tarik beban dari posisi lantai yang lebih dalam dengan fokus dorongan kaki awal yang kuat","Kunci pinggul di puncak dan turunkan kembali terkontrol"],
    mistakes: ["Punggung bawah membulat akibat rentang gerak yang lebih dalam","Menggunakan beban yang terlalu berat"],
  },
  "stiff-leg-deadlift": {
    videoId: "1uDiW5--rAE",
    setup: ["Berdiri dengan kaki selebar pinggul, lutut hampir lurus sepenuhnya","Pegang bar tepat di depan paha"],
    execution: ["Dorong pinggul ke belakang dan condongkan badan ke depan dengan kaki tetap hampir lurus","Rasakan peregangan intens pada hamstring dan glutes, lalu kembali berdiri tegak"],
    mistakes: ["Mengunci sendi lutut secara hiperekstensi","Membulatkan tulang belakang atas dan bawah"],
  },
  "snatch-grip-deadlift": {
    videoId: "x8QyA2X5uQY",
    setup: ["Genggam bar dengan jarak sangat lebar mendekati cincin luar barbell","Buka dada dan turunkan pinggul lebih rendah dari deadlift biasa"],
    execution: ["Tarik beban dari lantai dengan mengunci otot upper back dan trapezius","Berdiri tegak secara penuh"],
    mistakes: ["Genggaman terlepas (gunakan hook grip atau straps)","Upper back membulat"],
  },
  "rack-pulls": {
    videoId: "u7ne1u_hA2Y",
    setup: ["Letakkan bar di atas safety pins rak listrik setinggi tepat di bawah atau di atas lutut","Posisikan kaki seperti konvensional deadlift"],
    execution: ["Kunci belikat dan kencangkan core","Tarik bar ke atas hingga pinggul terkunci penuh","Fokus pada beban berat untuk menguatkan penguncian upper back"],
    mistakes: ["Melengkungkan pinggang ke belakang secara berlebihan di puncak (hyperextending)","Membanting bar ke pin rak"],
  },
  "dumbbell-romanian-deadlift": {
    videoId: "_oyxCn2iSjU",
    setup: ["Berdiri tegak memegang sepasang dumbbell di depan paha","Lutut sedikit ditekuk"],
    execution: ["Dorong bokong ke belakang sejauh mungkin sambil menjaga dumbbell meluncur di dekat paha dan tulang kering","Kontraksikan glutes untuk kembali ke posisi awal"],
    mistakes: ["Dumbbell melayang jauh ke depan tubuh","Punggung bawah membungkuk"],
  },
  "single-leg-dumbbell-deadlift": {
    videoId: "1FmW3X1bE_Y",
    setup: ["Berdiri pada satu kaki, pegang dumbbell di tangan yang berlawanan atau kedua tangan","Kaki lainnya rileks siap diangkat"],
    execution: ["Engsel pinggul ke belakang sambil mengangkat kaki belakang lurus sejajar badan","Turunkan dumbbell ke pertengahan tulang kering lalu kembali berdiri tegak"],
    mistakes: ["Pinggul berotasi terbuka ke samping alih-alih menghadap lantai","Kehilangan fokus titik pandang keseimbangan"],
  },
  "kettlebell-deadlift": {
    videoId: "zP0T7Qz0iT4",
    setup: ["Posisikan kettlebell di antara kedua kaki","Kaki selebar bahu, raih pegangan kettlebell dengan mendorong pinggul ke belakang"],
    execution: ["Dorong telapak kaki ke lantai dan dorong pinggul ke depan untuk berdiri tegak","Turunkan kembali dengan engsel pinggul"],
    mistakes: ["Membungkukkan punggung saat meraih kettlebell","Jongkok terlalu dalam seperti squat"],
  },
  "trap-bar-hex-bar-deadlift": {
    videoId: "9b8O4Ym45Ew",
    setup: ["Berdiri di tengah hex bar dengan kaki selebar bahu","Genggam pegangan netral di samping tubuh","Tegakkan dada dan luruskan tulang belakang"],
    execution: ["Dorong lantai menjauh dengan kombinasi kekuatan paha depan dan pinggul","Berdiri tegak secara mulus tanpa melengkungkan punggung ke belakang"],
    mistakes: ["Lutut kolaps ke dalam","Tidak mengunci pinggul di puncak gerakan"],
  },
  "pull-up": {
    videoId: "eGo4IYlbE5g",
    setup: ["Genggam bar dengan posisi tangan overhand (pronasikan telapak menghadap ke depan) lebih lebar dari bahu","Mulai dari posisi dead hang dengan lengan lurus"],
    execution: ["Depresi dan retraksi belikat terlebih dahulu","Tarik tubuh ke atas hingga dagu melewati bar dengan mengarahkan siku ke pinggul","Turunkan tubuh kembali terkontrol ke posisi lengan lurus"],
    mistakes: ["Mengayunkan kaki atau kipping","Tidak mencapai dead hang di bagian bawah (half reps)"],
  },
  "chin-up": {
    videoId: "b-Addsbfd8g",
    setup: ["Genggam bar dengan telapak tangan menghadap ke arah wajah (supinasi) selebar bahu","Lengan lurus menggantung"],
    execution: ["Tarik badan ke atas dengan fokus pada otot bicep dan lats hingga dagu melampaui bar","Turunkan perlahan hingga lengan lurus"],
    mistakes: ["Mengayunkan tubuh","Menjatuhkan badan secara tiba-tiba tanpa kontrol eksentrik"],
  },
  "lat-pulldown": {
    videoId: "CAwf7n6Luuc",
    setup: ["Kunci paha di bawah bantalan penahan","Genggam bar dengan lebar 1.5x lebar bahu, condongkan tubuh sedikit ke belakang (~10-15°)"],
    execution: ["Tarik bar ke dada bagian atas dengan mengarahkan siku ke bawah dan ke dalam","Remas otot lats di bagian bawah gerakan","Kembalikan bar ke atas secara perlahan hingga lats teregang"],
    mistakes: ["Mengayunkan tubuh terlalu jauh ke belakang (momentum)","Menarik bar ke belakang leher (risiko cedera rotator cuff)"],
  },
  "close-grip-lat-pulldown": {
    videoId: "lueEJGjTuPQ",
    setup: ["Pasang V-bar atau attachment pegangan netral rapat pada mesin pulldown","Duduk dengan paha terkunci di bantalan"],
    execution: ["Tarik handle ke arah dada atas sambil membusungkan dada","Fokus rasakan kontraksi lats bagian bawah"],
    mistakes: ["Mengayunkan punggung ke belakang terlalu jauh","Siku melebar ke luar"],
  },
  "straight-arm-cable-pulldown": {
    videoId: "gT_uI0gV6V4",
    setup: ["Gunakan straight bar atau tali pada kabel tinggi","Mundur satu langkah, condongkan tubuh ke depan dengan lengan hampir lurus"],
    execution: ["Tarik bar ke bawah ke arah paha hanya dengan menggerakkan sendi bahu","Remas otot lats di bawah, lalu kembalikan perlahan ke atas"],
    mistakes: ["Menekuk siku terlalu dalam (berubah jadi triceps pushdown)","Mengayunkan badan"],
  },
  "barbell-row": {
    videoId: "FWJR5Ve8gkQ",
    setup: ["Berdiri dengan kaki selebar pinggul, tekuk lutut sedikit dan condongkan torso ke depan 45 derajat","Genggam bar sedikit lebih lebar dari lutut dengan punggung lurus"],
    execution: ["Tarik bar ke arah pusar/perut bawah dengan memimpin menggunakan siku","Rapatkan tulang belikat di puncak gerakan","Turunkan bar perlahan ke posisi awal"],
    mistakes: ["Punggung terlalu tegak (menjadi upright row)","Menghentak torso ke atas untuk mengangkat beban"],
  },
  "seated-cable-row": {
    videoId: "GZbfZ033f74",
    setup: ["Duduk di mesin row dengan kaki di pijakan dan lutut sedikit ditekuk","Pegang V-grip dengan punggung tegak lurus"],
    execution: ["Tarik pegangan ke arah perut bawah sambil merapatkan belikat","Jaga postur dada tetap membusung bangga","Biarkan lengan lurus kembali dengan kontrol tanpa membungkukkan punggung"],
    mistakes: ["Mengayunkan punggung maju mundur berlebihan","Bahu mengangkat ke telinga"],
  },
  "t-bar-row": {
    videoId: "j3Igk5nyZE4",
    setup: ["Posisikan kaki kokoh di kedua sisi platform T-bar","Bungkukkan badan 45 derajat dengan tulang belakang netral, pegang handle"],
    execution: ["Tarik pegangan ke arah dada bawah/perut atas dengan menarik siku ke belakang","Remas otot punggung tengah di puncak, lalu turunkan terkontrol"],
    mistakes: ["Punggung bawah membulat","Mengayunkan lutut untuk mengangkat beban"],
  },
  "single-arm-dumbbell-row": {
    videoId: "dFzUjzfih7k",
    setup: ["Tempatkan satu lutut dan satu tangan di bangku datar, kaki lainnya menapak kokoh di lantai","Pegang dumbbell dengan lengan lurus"],
    execution: ["Tarik dumbbell ke arah pinggul dengan menggerakkan siku ke atas dan ke belakang","Hindari memutar torso secara berlebihan"],
    mistakes: ["Memutar dada ke arah samping untuk menaikkan beban","Menarik beban ke arah ketiak alih-alih ke arah pinggul"],
  },
  "back-extension": {
    videoId: "ph3pddpKzzw",
    setup: ["Atur bantalan mesin 45 derajat tepat di bawah lipatan pinggul","Kaitkan pergelangan kaki di penahan belakang"],
    execution: ["Bungkukkan tubuh ke depan secara terkontrol","Angkat badan kembali menggunakan otot glutes dan hamstring hingga tubuh lurus"],
    mistakes: ["Melengkungkan tulang belakang terlalu jauh ke belakang (hyperextension)","Mengayunkan tubuh dengan momentum"],
  },
  "band-pull-apart": {
    videoId: "JObXOnznsqE",
    setup: ["Pegang resistance band di depan dada dengan lengan lurus sejajar lantai","Posisikan telapak tangan menghadap ke bawah atau netral"],
    execution: ["Rentangkan band ke samping hingga menyentuh dada dengan merapatkan belikat ke belakang","Kembalikan perlahan ke posisi awal"],
    mistakes: ["Mengangkat bahu ke arah telinga","Menekuk siku saat menarik"],
  },
  "barbell-overhead-press": {
    videoId: "2yjwXTZQDDI",
    setup: ["Pegang bar selebar bahu tepat di atas dada atas/tulang selangka","Rapatkan glutes dan kencangkan otot inti","Kaki selebar bahu"],
    execution: ["Dorong bar vertikal lurus ke atas, sedikit tarik kepala ke belakang agar bar lewat","Setelah bar melewati kepala, dorong kepala sedikit ke depan","Kunci beban stabil di atas kepala"],
    mistakes: ["Pinggang melengkung ke belakang berlebihan","Bar didorong melengkung ke depan alih-alih vertikal lurus"],
  },
  "shoulder-press": {
    videoId: "qEwKCR5JCog",
    setup: ["Duduk di bangku dengan sandaran tegak","Angkat dumbbell setinggi bahu dengan telapak tangan menghadap ke depan"],
    execution: ["Dorong dumbbell lurus ke atas hingga lengan hampir lurus","Turunkan kembali perlahan hingga setinggi telinga"],
    mistakes: ["Membenturkan dumbbell di puncak","Punggung bawah lepas dari sandaran bangku"],
  },
  "seated-dumbbell-shoulder-press": {
    videoId: "qEwKCR5JCog",
    setup: ["Setel bangku ke sudut 75–85 derajat, dudukkan tubuh dengan punggung menempel rata","Pegang dumbbell di samping telinga"],
    execution: ["Dorong beban ke atas secara simultan membentuk busur lembut","Turunkan kembali ke level telinga dengan tempo 2 detik"],
    mistakes: ["Menurunkan beban terlalu dangkal","Menekan punggung bawah melengkung"],
  },
  "machine-shoulder-press": {
    videoId: "WvLMauqrnK8",
    setup: ["Atur tinggi dudukan sehingga handle sejajar dengan bahu","Punggung menempel kokoh pada sandaran"],
    execution: ["Dorong handle ke atas hingga lengan hampir lurus","Turunkan kembali perlahan hingga pegangan setinggi rahang"],
    mistakes: ["Siku terkunci keras di puncak","Bahu terangkat"],
  },
  "arnold-press": {
    videoId: "6Z15_WdXmVw",
    setup: ["Duduk tegak, pegang dumbbell di depan dada dengan telapak tangan menghadap ke arah wajah (seperti posisi puncak curl)"],
    execution: ["Sambil mendorong beban ke atas, putar pergelangan tangan keluar hingga di atas kepala telapak menghadap ke depan","Putar kembali ke posisi awal saat menurunkan beban"],
    mistakes: ["Memutar pergelangan secara tersendat-sendat alih-alih satu gerakan mulus","Beban terlalu berat"],
  },
  "lateral-raise": {
    videoId: "3VcKaXpzqRo",
    setup: ["Berdiri tegak atau duduk, pegang dumbbell di samping paha dengan sedikit condong ke depan","Tekuk siku sedikit (~10-15°)"],
    execution: ["Angkat lengan ke samping hingga setinggi bahu dengan memimpin menggunakan siku","Posisikan jempol sedikit lebih rendah dari kelingking (seperti menuang air)","Turunkan perlahan 2–3 detik"],
    mistakes: ["Mengayunkan tubuh untuk mengangkat dumbbell","Mengangkat beban melebihi tinggi bahu"],
  },
  "banded-lateral-raise": {
    videoId: "PPrzBWZDOhA",
    setup: ["Injak bagian tengah resistance band dengan satu atau dua kaki","Pegang ujung band di samping paha"],
    execution: ["Angkat lengan ke samping hingga setinggi bahu melawan resistensi karet","Tahan kontraksi 1 detik di puncak lalu turunkan terkontrol"],
    mistakes: ["Mengayunkan pinggul","Menekuk siku terlalu banyak"],
  },
  "cable-lateral-raise": {
    videoId: "PPrzBWZDOhA",
    setup: ["Atur katrol kabel ke posisi terendah","Berdiri di samping mesin, pegang handle dengan tangan yang berada di sisi luar"],
    execution: ["Tarik kabel ke samping hingga setinggi bahu","Rasakan ketegangan konstan sepanjang lintasan, lalu turunkan perlahan"],
    mistakes: ["Bahu terangkat ke arah telinga","Badan condong terlalu jauh ke samping"],
  },
  "dumbbell-front-raise": {
    videoId: "-t7fuZ0KhDA",
    setup: ["Berdiri tegak dengan dumbbell di depan paha, telapak menghadap ke paha","Kunci core"],
    execution: ["Angkat dumbbell ke depan lurus hingga setinggi mata","Turunkan perlahan ke posisi awal"],
    mistakes: ["Mengayunkan punggung ke belakang","Mengangkat beban terlalu tinggi di atas kepala"],
  },
  "cable-face-pull": {
    videoId: "rep-qVOkqgk",
    setup: ["Pasang tali di katrol kabel setinggi mata atau dahi","Genggam tali dengan jempol menghadap ke belakang"],
    execution: ["Mundur satu langkah, tarik tali ke arah hidung/dahi dengan memisahkan kedua ujung tali","Putar bahu ke luar (external rotation) dan remas otot rear delt di akhir gerakan"],
    mistakes: ["Siku jatuh di bawah garis bahu","Kepala maju menyambut tali alih-alih menarik tali ke wajah"],
  },
  "reverse-pec-deck": {
    videoId: "2kTvhqDkQYI",
    setup: ["Duduk menghadap mesin pec deck dengan dada menempel pada bantalan","Pegang handle dengan lengan sejajar lantai"],
    execution: ["Tarik handle ke belakang membentuk lengkungan horizontal menggunakan otot bahu belakang (rear delt)","Tahan sejenak lalu kembali perlahan"],
    mistakes: ["Bahu mengangkat ke atas","Menggunakan otot punggung tengah alih-alih fokus pada rear deltoid"],
  },
  "dumbbell-rear-delt-fly": {
    videoId: "ea_0pUj6Ppg",
    setup: ["Duduk di ujung bangku dan bungkukkan badan hingga dada menempel paha, atau berdiri membungkuk","Pegang dumbbell di bawah kaki"],
    execution: ["Angkat dumbbell ke samping dengan memimpin menggunakan siku hingga lengan sejajar lantai","Remas bahu belakang lalu turunkan terkontrol"],
    mistakes: ["Mengayunkan torso naik turun","Menekuk siku terlalu banyak"],
  },
  "pike-push-up": {
    videoId: "sposDXWEB0A",
    setup: ["Posisikan tubuh dalam bentuk huruf V terbalik (downward dog), pinggul terangkat tinggi dan tangan di lantai selebar bahu"],
    execution: ["Turunkan kepala ke depan membentuk segitiga dengan kedua tangan","Dorong lantai menjauh hingga kembali ke posisi V terbalik"],
    mistakes: ["Siku melebar ke samping alih-alih mengarah ke belakang ~45°","Pinggul turun menjadi push-up biasa"],
  },
  "upright-row": {
    videoId: "amCU-ziHITM",
    setup: ["Pegang barbell, dumbbell, atau kabel dengan jarak sedikit lebih lebar dari bahu","Berdiri tegak"],
    execution: ["Tarik beban lurus ke atas sepanjang tubuh hingga setinggi dada atas dengan memimpin menggunakan siku","Turunkan perlahan"],
    mistakes: ["Genggaman terlalu sempit yang menyebabkan benturan sendi bahu (impingement)","Mengangkat siku melebihi telinga"],
  },
  "barbell-shrugs": {
    videoId: "M_8qQ92q4-A",
    setup: ["Berdiri tegak memegang bar di depan paha dengan genggaman selebar bahu","Lengan lurus sepenuhnya"],
    execution: ["Angkat bahu lurus ke atas setinggi mungkin ke arah telinga","Tahan kontraksi trapezius 1–2 detik di puncak, lalu turunkan perlahan"],
    mistakes: ["Memutar bahu ke belakang atau ke depan (risiko aus sendi)","Menekuk siku untuk mengangkat beban"],
  },
  "dumbbell-shrugs": {
    videoId: "cJRVVxmytaM",
    setup: ["Berdiri tegak memegang sepasang dumbbell di samping tubuh","Postur dada tegak"],
    execution: ["Tarik bahu lurus ke atas ke arah telinga","Remas trapezius di puncak lalu turunkan dengan rentang gerak penuh"],
    mistakes: ["Memutar sendi bahu dalam lingkaran","Mengayunkan tubuh"],
  },
  "barbell-bicep-curl": {
    videoId: "ykJmrZ5v0Oo",
    setup: ["Berdiri tegak, pegang bar dengan telapak tangan menghadap ke atas (supinasi) selebar bahu","Siku rapat di samping pinggang"],
    execution: ["Angkat bar ke arah dada dengan menekuk siku tanpa menggerakkan tubuh","Remas bicep di puncak gerakan selama 1 detik","Turunkan bar perlahan ke posisi awal dengan rentang gerak penuh"],
    mistakes: ["Mengayunkan pinggul untuk membantu mengangkat (cheating)","Siku maju terlalu jauh ke depan"],
  },
  "dumbbell-curl": {
    videoId: "sAq_ocpRh_I",
    setup: ["Pegang dumbbell di samping badan dengan telapak tangan menghadap ke dalam","Berdiri tegak dengan postur dada membusung"],
    execution: ["Putar telapak tangan ke atas (supinasi) sambil mengangkat dumbbell ke arah bahu","Tahan kontraksi di puncak, turunkan perlahan"],
    mistakes: ["Siku bergerak menjauh dari samping badan","Menjatuhkan beban tanpa kontrol eksentrik"],
  },
  "hammer-curl": {
    videoId: "zC3nLlEvin4",
    setup: ["Berdiri tegak, pegang dumbbell dengan posisi netral (telapak tangan saling berhadapan seperti memegang palu)","Siku rapat di rusuk"],
    execution: ["Angkat dumbbell ke atas secara bersamaan atau bergantian tanpa memutar pergelangan tangan","Remas otot brachialis dan forearm di puncak"],
    mistakes: ["Mengayunkan bahu ke depan","Menggunakan beban terlalu berat sehingga postur rusak"],
  },
  "preacher-curl": {
    videoId: "fIWP-FRFNU0",
    setup: ["Duduk di bangku preacher, letakkan ketiak pas di atas bantalan miring","Pegang EZ-bar atau dumbbell dengan lengan menempel penuh di bantalan"],
    execution: ["Angkat bar hingga bicep terkontraksi penuh","Turunkan perlahan hingga lengan hampir lurus (jangan overextend sendi siku)"],
    mistakes: ["Mengangkat bokong dari kursi saat beban berat","Menurunkan beban terlalu cepat di titik bawah"],
  },
  "incline-dumbbell-curl": {
    videoId: "soxrZlIl35U",
    setup: ["Setel bangku ke sudut 45–60 derajat","Duduk bersandar penuh dan biarkan lengan menggantung lurus ke bawah di samping bangku"],
    execution: ["Curl dumbbell ke atas dengan menjaga siku tetap mengarah ke lantai","Rasakan regangan mendalam pada kepala panjang bicep lalu remas di puncak"],
    mistakes: ["Menggerakkan siku ke depan saat mengangkat beban","Kepala terangkat dari sandaran bangku"],
  },
  "cable-bicep-curl": {
    videoId: "NFzTWp2qpiE",
    setup: ["Pasang straight bar pada katrol kabel bawah","Berdiri tegak menghadap katrol dengan siku rapat di pinggang"],
    execution: ["Tarik bar ke arah dada atas dengan kontraksi bicep","Turunkan perlahan dengan melawan tarikan konstan kabel"],
    mistakes: ["Mengayunkan torso ke belakang","Siku bergerak maju mundur"],
  },
  "concentration-curl": {
    videoId: "0AUGkch3tzc",
    setup: ["Duduk di tepi bangku, sandarkan bagian belakang lengan atas (di atas siku) ke bagian dalam paha","Pegang dumbbell menggantung"],
    execution: ["Curl dumbbell ke arah wajah hanya dengan menggerakkan lengan bawah","Tahan kontraksi 1 detik di puncak lalu turunkan perlahan"],
    mistakes: ["Mengayunkan torso untuk mengangkat beban","Menggeser titik tumpu siku di paha"],
  },
  "banded-bicep-curl": {
    videoId: "4yqQ_rQ4-W4",
    setup: ["Injak resistance band dengan kedua kaki, pegang ujung pegangan atau karet dengan telapak menghadap ke atas"],
    execution: ["Curl tangan ke arah bahu melawan tarikan elastis band","Tahan kontraksi maksimal di puncak lalu turunkan terkontrol"],
    mistakes: ["Melepaskan regangan band secara mendadak","Siku melebar ke samping"],
  },
  "reverse-grip-barbell-curl": {
    videoId: "nRisHW32nKs",
    setup: ["Pegang bar dengan posisi telapak tangan menghadap ke bawah (pronasi) selebar bahu","Siku rapat di pinggang"],
    execution: ["Angkat bar ke arah dada atas dengan fokus pada otot brachioradialis dan forearm","Turunkan perlahan"],
    mistakes: ["Menekuk pergelangan tangan ke atas secara berlebihan","Mengayunkan badan"],
  },
  "wrist-curls": {
    videoId: "FW7URAaC_I8",
    setup: ["Duduk dan sandarkan lengan bawah di atas paha atau bangku datar dengan pergelangan tangan menggantung di tepi","Pegang barbel atau dumbbell"],
    execution: ["Turunkan pergelangan tangan ke bawah sejauh mungkin, lalu tekuk ke atas setinggi mungkin","Tahan kontraksi forearm sejenak"],
    mistakes: ["Mengangkat lengan bawah dari paha/bangku","Gerakan terlalu cepat dan menyentak"],
  },
  "plank": {
    videoId: "ASdvN_XEl_c",
    setup: ["Bertumpu pada lengan bawah dan ujung jari kaki","Tubuh membentuk satu garis lurus dari kepala hingga tumit"],
    execution: ["Kencangkan perut, rapatkan glutes, dorong lantai dengan lengan bawah agar belikat tidak kolaps","Bernapas stabil"],
    mistakes: ["Pinggul turun ke bawah atau terangkat terlalu tinggi","Menahan napas"],
  },
  "side-plank": {
    videoId: "N_cbdfwV0Gs",
    setup: ["Berbaring miring bertumpu pada satu siku tepat di bawah bahu, kaki ditumpuk sejajar"],
    execution: ["Angkat pinggul hingga tubuh membentuk garis lurus diagonal dari kepala ke tumit","Tahan posisi dengan mengencangkan otot oblique"],
    mistakes: ["Pinggul turun mendekati lantai","Torso berputar condong ke depan"],
  },
  "plank-to-push-up": {
    videoId: "L4oFJRDAU4Q",
    setup: ["Mulai dari posisi plank bertumpu pada siku","Kunci core dan glutes"],
    execution: ["Letakkan satu telapak tangan di tempat siku berada, lalu dorong naik dengan tangan satunya ke posisi push-up","Turunkan kembali satu per satu ke siku"],
    mistakes: ["Pinggul bergoyang ke kiri dan kanan secara liar (jaga tetap stabil)","Leher ditekuk ke bawah"],
  },
  "ab-wheel-rollout": {
    videoId: "rqiTPdK1cWg",
    setup: ["Berlutut dengan roda ab wheel di bawah bahu","Kunci core dan sedikit bulatkan punggung atas (hollow position)"],
    execution: ["Dorong roda ke depan sejauh mungkin dengan menjaga perut tetap terkunci kencang","Tarik kembali roda ke posisi awal menggunakan kekuatan abs"],
    mistakes: ["Pinggang melorot ke bawah (tanda core gagal menahan beban)","Pinggul mundur ke tumit lebih awal"],
  },
  "hanging-straight-leg-raise": {
    videoId: "hdng3Nm1x_E",
    setup: ["Bergantung pada bar dengan tubuh lurus dan bahu aktif"],
    execution: ["Angkat kaki lurus ke atas hingga membentuk sudut 90 derajat atau lebih tinggi","Gunakan perut untuk menggulung panggul ke atas"],
    mistakes: ["Mengayunkan badan untuk mendapatkan momentum","Hanya mengangkat paha tanpa menggulung panggul"],
  },
  "hanging-knee-raise": {
    videoId: "RD_A-Z15Er4",
    setup: ["Bergantung pada pull-up bar dengan lengan lurus","Rapatkan kedua lutut"],
    execution: ["Tarik kedua lutut ke arah dada sambil memutar panggul ke atas","Turunkan perlahan tanpa membiarkan tubuh berayun"],
    mistakes: ["Mengayunkan badan maju mundur","Menjatuhkan kaki tanpa kontrol"],
  },
  "toes-to-bar": {
    videoId: "6dHvTlsMvNY",
    setup: ["Bergantung pada pull-up bar dengan cengkeraman kuat","Mulai dari posisi hollow body"],
    execution: ["Tarik bar ke bawah dengan lats sambil melipat tubuh hingga ujung jari kaki menyentuh bar","Turunkan kembali terkontrol"],
    mistakes: ["Menggunakan kipping berlebihan tanpa kekuatan kontrol core","Menekuk lutut secara penuh"],
  },
  "dragon-flag": {
    videoId: "jWc87L36Uak",
    setup: ["Berbaring di bangku dan pegang erat tepi bangku di samping kepala"],
    execution: ["Angkat seluruh tubuh lurus ke atas hanya bertumpu pada pundak","Turunkan tubuh perlahan sebagai satu garis lurus tanpa menekuk pinggang"],
    mistakes: ["Pinggang tertekuk sehingga tubuh tidak lurus","Menjatuhkan tubuh terlalu cepat"],
  },
  "cable-rope-crunch": {
    videoId: "6GMKPQVERTE",
    setup: ["Berlutut di depan mesin katrol tinggi dengan memegang tali di samping telinga","Kunci posisi pinggul sedikit di depan tumit"],
    execution: ["Tarik napas, lalu hembuskan sambil menekuk tulang belakang dan mendekatkan siku ke arah paha menggunakan otot perut","Tahan kontraksi 1 detik di bawah"],
    mistakes: ["Duduk ke tumit (gerakan harus berasal dari tekukan perut, bukan pinggul)","Menarik dengan kekuatan lengan"],
  },
  "reverse-crunch": {
    videoId: "hyv14e2QDq0",
    setup: ["Berbaring telentang di matras dengan tangan di samping tubuh, tekuk lutut 90 derajat"],
    execution: ["Tarik lutut ke arah dada dan angkat panggul serta punggung bawah sedikit dari lantai menggunakan kekuatan perut bawah","Turunkan kembali perlahan"],
    mistakes: ["Mengayunkan kaki dengan momentum","Membanting panggul ke lantai"],
  },
  "bicycle-crunches": {
    videoId: "9FGilxCbdz8",
    setup: ["Berbaring telentang dengan tangan di belakang kepala (jangan menarik leher), angkat kaki dan bahu sedikit dari lantai"],
    execution: ["Putar torso dan arahkan siku kanan ke lutut kiri yang ditekuk, sementara kaki kanan lurus","Ganti sisi secara bergantian dengan gerakan mengayuh terkontrol"],
    mistakes: ["Menarik kepala dan leher ke depan","Gerakan terlalu cepat tanpa kontraksi oblique"],
  },
  "decline-weighted-sit-up": {
    videoId: "sK1S3_a6vF8",
    setup: ["Kaitkan kaki pada bangku decline, pegang piringan beban rapat di depan dada"],
    execution: ["Turunkan tubuh hingga punggung hampir menyentuh bangku","Angkat tubuh kembali ke atas menggunakan kontraksi otot perut"],
    mistakes: ["Menarik leher","Mengayunkan beban menjauh dari dada untuk momentum"],
  },
  "leg-raises": {
    videoId: "JB2oyawG9KI",
    setup: ["Berbaring telentang di matras, letakkan tangan di samping pinggul atau di bawah bokong untuk menyangga punggung bawah"],
    execution: ["Angkat kedua kaki lurus ke atas hingga sudut 90 derajat","Turunkan perlahan hingga hampir menyentuh lantai tanpa melepaskan kontak punggung bawah"],
    mistakes: ["Punggung bawah melengkung terangkat dari lantai","Menjatuhkan kaki dengan cepat"],
  },
  "russian-twist": {
    videoId: "wkD8rjkodUI",
    setup: ["Duduk di lantai dengan lutut ditekuk, condongkan tubuh ke belakang sekitar 45 derajat (angkat kaki untuk tantangan lebih)"],
    execution: ["Putar torso dari sisi kiri ke sisi kanan secara terkontrol sambil memegang dumbbell atau piringan beban","Ikuti gerakan dengan pandangan mata"],
    mistakes: ["Hanya menggerakkan lengan tanpa memutar torso/tulang belakang","Punggung membungkuk parah"],
  },
  "deadbug": {
    videoId: "g_BYB0R-4Ws",
    setup: ["Berbaring telentang dengan lengan lurus mengarah ke langit-langit dan lutut ditekuk 90 derajat di udara","Tempelkan punggung bawah ke matras"],
    execution: ["Turunkan lengan kanan ke belakang kepala dan luruskan kaki kiri ke depan secara bersamaan","Kembalikan ke posisi awal dan ulangi untuk sisi berlawanan"],
    mistakes: ["Punggung bawah melengkung terangkat dari lantai saat kaki turun","Menahan napas"],
  },
  "hollow-body-hold": {
    videoId: "V2xhmXWwE_o",
    setup: ["Berbaring telentang dengan lengan lurus di belakang kepala dan kaki lurus"],
    execution: ["Angkat lengan, kepala, bahu, dan kaki beberapa sentimeter dari lantai","Tekan punggung bawah kuat-kuat ke lantai sehingga tubuh membentuk bentuk mangkuk/pisang"],
    mistakes: ["Punggung bawah terangkat dari lantai","Menekuk lutut"],
  },
  "pallof-press": {
    videoId: "AH_QZLM_0-s",
    setup: ["Berdiri menyamping dari mesin kabel atau resistance band setinggi dada","Pegang handle dengan kedua tangan di tengah dada"],
    execution: ["Dorong handle lurus ke depan menjauh dari dada dan tahan rotasi tubuh","Tahan posisi lurus selama 2 detik lalu bawa kembali ke dada"],
    mistakes: ["Membiarkan badan terputar ke arah tarikan kabel","Bahu tegang terangkat"],
  },
  "cable-woodchoppers": {
    videoId: "17oUvK9G6iM",
    setup: ["Atur katrol kabel ke posisi paling bawah, berdiri menyamping dari mesin","Pegang handle di dekat lutut luar"],
    execution: ["Tarik kabel menyilang ke arah atas melintasi tubuh hingga melewati bahu yang berlawanan","Kencangkan otot oblique di puncak gerakan"],
    mistakes: ["Melengkungkan tulang belakang ke belakang","Mengabaikan rotasi kaki dan pinggul"],
  },
  "mountain-climbers": {
    videoId: "nmwgirgXLYM",
    setup: ["Mulai dalam posisi push-up standar dengan tangan di bawah bahu dan tubuh lurus"],
    execution: ["Dorong satu lutut ke arah dada secara cepat dan bergantian seperti berlari di lantai","Jaga agar pinggul tetap sejajar tidak terangkat tinggi"],
    mistakes: ["Pinggul melambung terlalu tinggi ke udara","Tangan tergelincir maju menjauh dari bahu"],
  },
  "burpees": {
    videoId: "auBLPXO8Fww",
    setup: ["Berdiri tegak dengan kaki selebar bahu"],
    execution: ["Jongkok dan letakkan tangan di lantai, tendang kaki ke belakang ke posisi push-up","Lakukan push-up, lompatkan kaki kembali ke dekat tangan, dan melompat eksplosif ke atas dengan tangan di atas kepala"],
    mistakes: ["Punggung melorot saat berada di posisi plank","Mendarat dengan lutut kaku tanpa ditekuk"],
  },
  "jump-rope": {
    videoId: "1BZM2Vre5oc",
    setup: ["Pegang pegangan tali skipping di samping pinggul dengan siku dekat ke rusuk","Berdiri di atas bola kaki"],
    execution: ["Putar tali menggunakan pergelangan tangan (bukan seluruh lengan)","Melompat ringan 2–3 cm dari lantai tepat saat tali lewat di bawah kaki"],
    mistakes: ["Melompat terlalu tinggi atau menekuk lutut ke belakang","Memutar tali menggunakan seluruh bahu"],
  },
  "jump-squats": {
    videoId: "A-cFYWvaW3I",
    setup: ["Berdiri dengan kaki selebar bahu, tangan di depan dada"],
    execution: ["Turun ke posisi squat hingga paha sejajar lantai, lalu dorong eksplosif dan melompat setinggi mungkin","Mendarat dengan lembut dari ujung jari kaki ke tumit dengan lutut meredam benturan"],
    mistakes: ["Mendarat dengan lutut terkunci lurus","Lutut kolaps ke dalam saat mendarat"],
  },
  "jumping-jacks": {
    videoId: "c4DAnQ6DtF8",
    setup: ["Berdiri tegak dengan kaki rapat dan tangan di samping paha"],
    execution: ["Lompat membuka kaki selebar bahu sambil mengangkat kedua lengan ke atas kepala","Lompat kembali ke posisi awal secara berirama"],
    mistakes: ["Mendarat keras dengan tumit membentur lantai","Lengan tidak terangkat penuh"],
  },
  "high-knees": {
    videoId: "oDdkytliOqE",
    setup: ["Berdiri tegak dengan kaki selebar pinggul"],
    execution: ["Lari di tempat dengan mengangkat lutut setinggi pinggul secara bergantian dengan ritme cepat","Ayunkankan lengan secara sinkron"],
    mistakes: ["Badan condong terlalu jauh ke belakang","Lutut diangkat terlalu rendah"],
  },
  "rowing-machine": {
    videoId: "zQ82RYIFLN8",
    setup: ["Duduk di mesin rower, kencangkan strap pengikat kaki di tengah telapak kaki","Pegang pegangan dengan tangan lurus"],
    execution: ["Dorong kuat dengan kaki terlebih dahulu, condongkan badan ke belakang, lalu tarik pegangan ke rusuk bawah","Kembalikan lengan, condongkan badan ke depan, lalu tekuk lutut untuk meluncur kembali"],
    mistakes: ["Menarik dengan tangan sebelum kaki lurus mendorong (urutan salah)","Punggung membungkuk saat meluncur ke depan"],
  },
  "treadmill-run": {
    videoId: "brFHyOTTwHU",
    setup: ["Mulai dengan berjalan pemanasan di treadmill pada kecepatan rendah","Jaga postur tegak dengan pandangan lurus ke depan"],
    execution: ["Tingkatkan kecepatan ke target lari, mendarat dengan bagian tengah telapak kaki di bawah pusat gravitasi","Ayunkan lengan dengan rileks"],
    mistakes: ["Berpegangan pada handrail saat lari kencang","Melangkah terlalu panjang di depan tubuh (overstriding)"],
  }
};

/**
 * Resolves full video tutorial data for any given exercise.
 * Supports:
 * 1. Database-provided `videoUrl` (YouTube standard, shorts, embed, or HTML5 video)
 * 2. Curated verified tutorial mapping for all 120 exercise movements
 * 3. Intelligent archetype fallback based on exercise pattern
 * 4. Safe YouTube fallback without deprecated search playlist parameters
 */
export function resolveExerciseTutorial(name: string, videoUrl?: string | null): VideoEmbedData {
  // 1. If explicit URL provided in database
  if (videoUrl && videoUrl.trim()) {
    const trimmed = videoUrl.trim();
    const ytId = extractYouTubeId(trimmed);

    if (ytId) {
      const slug = exerciseNameToSlug(name);
      const baseSlug = exerciseNameToBaseSlug(name);
      const curated = CURATED_TUTORIALS[slug] || CURATED_TUTORIALS[baseSlug];
      return {
        embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${ytId}`,
        videoType: "youtube",
        videoId: ytId,
        formCues: curated
          ? { setup: curated.setup, execution: curated.execution, mistakes: curated.mistakes }
          : getDefaultFormCues(name),
      };
    }

    if (trimmed.endsWith(".mp4") || trimmed.endsWith(".webm")) {
      return {
        embedUrl: trimmed,
        watchUrl: trimmed,
        videoType: "html5",
        formCues: getDefaultFormCues(name),
      };
    }
  }

  // 2. Check curated dictionary by slug or baseSlug
  const slug = exerciseNameToSlug(name);
  const baseSlug = exerciseNameToBaseSlug(name);
  const c = CURATED_TUTORIALS[slug] || CURATED_TUTORIALS[baseSlug];
  if (c) {
    return {
      embedUrl: `https://www.youtube.com/embed/${c.videoId}?rel=0`,
      watchUrl: `https://www.youtube.com/watch?v=${c.videoId}`,
      videoType: "youtube",
      videoId: c.videoId,
      formCues: { setup: c.setup, execution: c.execution, mistakes: c.mistakes },
    };
  }

  // 3. Fallback matching by keyword archetype
  const n = name.toLowerCase();
  for (const [key, item] of Object.entries(CURATED_TUTORIALS)) {
    const cleanKey = key.replace(/-/g, " ");
    if (n.includes(cleanKey) || cleanKey.includes(n)) {
      return {
        embedUrl: `https://www.youtube.com/embed/${item.videoId}?rel=0`,
        watchUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
        videoType: "youtube",
        videoId: item.videoId,
        formCues: { setup: item.setup, execution: item.execution, mistakes: item.mistakes },
      };
    }
  }

  // 4. Safe Default: Direct watch link on YouTube search and safe baseline tutorial
  const query = encodeURIComponent(`${name} exercise form tutorial`);
  return {
    embedUrl: "https://www.youtube.com/embed/IODxDxX7oi4?rel=0",
    watchUrl: `https://www.youtube.com/results?search_query=${query}`,
    videoType: "search",
    videoId: "IODxDxX7oi4",
    formCues: getDefaultFormCues(name),
  };
}

/**
 * Standard default form cues for exercises that don't have custom text
 */
function getDefaultFormCues(name: string) {
  return {
    setup: [
      `Posisikan tubuh dengan stabil sebelum memulai ${name}`,
      "Atur pernapasan dan kencangkan otot inti (core bracing)",
      "Pastikan posisi sendi dan grip terasa nyaman dan aman",
    ],
    execution: [
      "Lakukan gerakan secara terkontrol tanpa menyentak",
      "Fokus pada kontraksi otot target di puncak gerakan (mind-muscle connection)",
      "Kembalikan beban ke posisi awal dengan tempo 2–3 detik (eksentrik)",
    ],
    mistakes: [
      "Menggunakan beban terlalu berat yang merusak postur teknik",
      "Memanfaatkan momentum ayunan tubuh alih-alih kekuatan otot",
      "Menahan napas saat melakukan repetisi berat",
    ],
  };
}
