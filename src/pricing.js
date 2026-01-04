/**
 * 福岡プライベートサウナ料金表
 * 各施設の料金情報（税込）
 */

const PRICING = {
  // BASE Private sauna
  base: {
    name: 'BASE Private sauna',
    url: 'https://coubic.com/base-private-sauna',
    note: '平日/土日祝で料金が異なる',
    plans: [
      { name: '80分1名', weekday: 5000, weekend: 5300, duration: 80, capacity: 1 },
      { name: '100分1名', weekday: 5800, weekend: 6100, duration: 100, capacity: 1 },
      { name: '120分1名', weekday: 6500, weekend: 6800, duration: 120, capacity: 1 },
      { name: '150分1名', weekday: 7500, weekend: 7800, duration: 150, capacity: 1 },
      { name: '80分2名', weekday: 7800, weekend: 8300, duration: 80, capacity: 2 },
      { name: '100分2名', weekday: 9100, weekend: 9600, duration: 100, capacity: 2 },
      { name: '120分2名', weekday: 10300, weekend: 10800, duration: 120, capacity: 2 },
      { name: '150分2名', weekday: 12000, weekend: 12500, duration: 150, capacity: 2 }
    ]
  },

  // KUDOCHI sauna 福岡中洲店
  kudochi: {
    name: 'KUDOCHI sauna 福岡中洲店',
    url: 'https://kudochi-sauna.com/fukuoka/',
    note: '部屋タイプ（定員）で料金が異なる',
    plans: [
      // スタンダード（定員2人）- Silk, Orca, Gold
      { name: 'Silk - 90分', price: 6000, duration: 90, capacity: 2, type: 'スタンダード' },
      { name: 'Silk - 120分', price: 8000, duration: 120, capacity: 2, type: 'スタンダード' },
      { name: 'Orca - 90分', price: 6000, duration: 90, capacity: 2, type: 'スタンダード' },
      { name: 'Orca - 120分', price: 8000, duration: 120, capacity: 2, type: 'スタンダード' },
      { name: 'Gold - 90分', price: 6000, duration: 90, capacity: 2, type: 'スタンダード' },
      { name: 'Gold - 120分', price: 8000, duration: 120, capacity: 2, type: 'スタンダード' },
      // スーペリア（定員3人）- Club, Grove
      { name: 'Club - 90分', price: 9000, duration: 90, capacity: 3, type: 'スーペリア' },
      { name: 'Club - 120分', price: 12000, duration: 120, capacity: 3, type: 'スーペリア' },
      { name: 'Grove - 90分', price: 9000, duration: 90, capacity: 3, type: 'スーペリア' },
      { name: 'Grove - 120分', price: 12000, duration: 120, capacity: 3, type: 'スーペリア' },
      // セミVIP（定員4人）- Oasis
      { name: 'Oasis - 120分', price: 16000, duration: 120, capacity: 4, type: 'セミVIP' },
      // VIP（定員6人）- Eden
      { name: 'Eden - 120分', price: 24000, duration: 120, capacity: 6, type: 'VIP' },
      // ナイトパック
      { name: 'スタンダード ナイト5時間', price: 12000, duration: 300, capacity: 2, type: 'ナイトパック' },
      { name: 'スーペリア ナイト5時間', price: 18000, duration: 300, capacity: 3, type: 'ナイトパック' },
      { name: 'セミVIP ナイト5時間', price: 24000, duration: 300, capacity: 4, type: 'ナイトパック' },
      { name: 'VIP ナイト5時間', price: 35000, duration: 300, capacity: 6, type: 'ナイトパック' }
    ]
  },

  // SAUNA OOO FUKUOKA
  saunaOoo: {
    name: 'SAUNA OOO FUKUOKA',
    url: 'https://ooo-sauna.com/fukuoka.html',
    note: '追加1名で加算あり',
    plans: [
      // サンカクの部屋（最大2名 / 15.5㎡）
      { name: 'サンカク（2名/15.5㎡）', price: 4500, priceMax: 6000, duration: 100, capacity: 1, extraPerson: 2500, maxCapacity: 2 },
      // マルの部屋（最大3名 / 17.0㎡）
      { name: 'マル（3名/17.0㎡）', price: 5000, priceMax: 6500, duration: 100, capacity: 1, extraPerson: 2500, maxCapacity: 3 },
      // シカクの部屋（最大4名 / 23.4㎡）
      { name: 'シカク（4名/23.4㎡）', weekday: 7000, weekend: 9000, duration: 120, capacity: 1, extraPerson: 3000, maxCapacity: 4 }
    ]
  },

  // SAUNA Giraffe 南天神
  giraffeMiamitenjin: {
    name: 'GIRAFFE 南天神',
    url: 'https://reserva.be/giraffe_minamitenjin',
    note: '人数で料金が異なる',
    plans: [
      { name: '「陽」1名', price: 6500, duration: 120, capacity: 1 },
      { name: '「陽」2名', price: 8500, duration: 120, capacity: 2 },
      { name: '「陽」3名', price: 10500, duration: 120, capacity: 3 },
      { name: '「陽」4名', price: 12500, duration: 120, capacity: 4 },
      { name: '「陰」1名', price: 6500, duration: 120, capacity: 1 },
      { name: '「陰」2名', price: 8500, duration: 120, capacity: 2 }
    ]
  },

  // SAUNA Giraffe 天神
  giraffeTenjin: {
    name: 'GIRAFFE 天神',
    url: 'https://reserva.be/giraffe_minamitenjin',
    note: '2名利用',
    plans: [
      { name: '和の静寂 120分', price: 8000, duration: 120, capacity: 2 },
      { name: '温冷交互 120分', price: 8000, duration: 120, capacity: 2 }
    ]
  },

  // SAUNA SAKURADO
  sakurado: {
    name: 'SAUNA SAKURADO',
    url: 'https://sauna-sakurado.spa/',
    note: '会員制（初回お試し可）、部屋により設備・料金が異なる',
    membershipFee: 22000, // 登録時のみ、年会費なし
    plans: [
      { name: '3-D（2名）- 125分', price: 9000, duration: 125, capacity: 2 },
      { name: '3-F（4名）- 95分', price: 15400, duration: 95, capacity: 4 },
      { name: '3-C（4名）- 125分', price: 17600, duration: 125, capacity: 4 },
      { name: '3-E（6名）- 135分', price: 24750, duration: 135, capacity: 6 },
      { name: '2-B（6名）- 140分', price: 40900, duration: 140, capacity: 6 },
      { name: '2-A（6名）- 140分', price: 46860, duration: 140, capacity: 6 }
    ]
  }
};

/**
 * 部屋名から料金を取得
 * @param {string} facilityKey - 施設キー（base, kudochi, saunaOoo, giraffe, sakurado）
 * @param {string} roomName - 部屋名
 * @param {boolean} isWeekend - 週末かどうか（BASEのみ使用）
 * @returns {number|null} 料金（円）
 */
function getPriceByRoom(facilityKey, roomName, isWeekend = false) {
  const facility = PRICING[facilityKey];
  if (!facility) return null;

  for (const plan of facility.plans) {
    if (roomName.includes(plan.name) || plan.name.includes(roomName)) {
      if (plan.weekday !== undefined) {
        return isWeekend ? plan.weekend : plan.weekday;
      }
      return plan.price;
    }
  }
  return null;
}

/**
 * 施設の料金一覧をフォーマットして取得
 * @param {string} facilityKey - 施設キー
 * @returns {string} フォーマットされた料金表
 */
function formatPricing(facilityKey) {
  const facility = PRICING[facilityKey];
  if (!facility) return '';

  let result = `${facility.name}\n`;
  if (facility.note) result += `※ ${facility.note}\n`;
  result += '\n';

  for (const plan of facility.plans) {
    if (plan.weekday !== undefined) {
      result += `${plan.name}: 平日¥${plan.weekday.toLocaleString()} / 土日祝¥${plan.weekend.toLocaleString()}\n`;
    } else {
      result += `${plan.name}: ¥${plan.price.toLocaleString()}`;
      if (plan.extraPerson) {
        result += ` (+1名¥${plan.extraPerson.toLocaleString()})`;
      }
      result += '\n';
    }
  }

  return result;
}

module.exports = { PRICING, getPriceByRoom, formatPricing };
