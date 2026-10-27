export type StoreIdentity = {
  id: number;
  name: string;
  address: string;
  phoneNumber: string | null;
  position: { lat: number; lng: number };
};

export type PlaceCandidate = {
  id: string;
  name: string;
  address: string;
  phoneNumber: string | null;
  lat: number | null;
  lng: number | null;
  url: string;
};

export type PlaceMatchResult =
  | { status: "matched"; candidate: PlaceCandidate; reason: string }
  | { status: "unmatched" | "ambiguous"; reason: string };

const provinceAliases: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주도: "제주",
  제주특별자치도: "제주",
};
const provinces = new Set(Object.values(provinceAliases));

type AddressIdentity = {
  normalized: string;
  province: string | undefined;
  municipalities: string[];
  districts: string[];
  streets: string[];
  neighborhoods: string[];
  numbers: Map<string, string>;
};

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

function normalizeName(value: string): string {
  return normalizeText(value).replace(/[\s\p{P}\p{S}]/gu, "");
}

function normalizePhone(value: string | null): string | null {
  if (value === null || !value.trim()) return null;
  let phone = normalizeText(value).replace(/[\s().-]/g, "");
  if (phone.startsWith("+82") || phone.startsWith("0082")) {
    phone = phone.slice(phone.startsWith("+82") ? 3 : 4);
    if (!phone.startsWith("0")) phone = `0${phone}`;
  }
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : null;
}

function hasInvalidPhone(value: string | null): boolean {
  return (
    value !== null && value.trim() !== "" && normalizePhone(value) === null
  );
}

function normalizeAddress(value: string): AddressIdentity {
  const tokens = normalizeText(value)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) =>
      Object.hasOwn(provinceAliases, token) ? provinceAliases[token] : token,
    );
  const localTokens = tokens.filter((token) => !provinces.has(token));
  const streets = localTokens.filter((token) =>
    /^[가-힣][가-힣0-9]*(?:로|길)$/.test(token),
  );
  const neighborhoods = localTokens.filter((token) =>
    /^[가-힣][가-힣0-9]*(?:읍|면|동|리)$/.test(token),
  );
  const numbers = new Map<string, string>();
  for (let index = 0; index < tokens.length - 1; index++) {
    if (
      (streets.includes(tokens[index]) ||
        neighborhoods.includes(tokens[index])) &&
      /^[0-9]+(?:-[0-9]+)?$/.test(tokens[index + 1])
    ) {
      numbers.set(tokens[index], tokens[index + 1]);
    }
  }
  return {
    normalized: tokens.join(" "),
    province: tokens.find((token) => provinces.has(token)),
    municipalities: localTokens.filter((token) =>
      /^[가-힣]+(?:시|군)$/.test(token),
    ),
    districts: localTokens.filter((token) => /^[가-힣]+구$/.test(token)),
    streets,
    neighborhoods,
    numbers,
  };
}

function overlaps(left: readonly string[], right: readonly string[]): boolean {
  return left.some((value) => right.includes(value));
}

function addressesConflict(
  left: AddressIdentity,
  right: AddressIdentity,
): boolean {
  if (left.province && right.province && left.province !== right.province)
    return true;
  for (const field of [
    "municipalities",
    "districts",
    "streets",
    "neighborhoods",
  ] as const) {
    if (
      left[field].length &&
      right[field].length &&
      !overlaps(left[field], right[field])
    )
      return true;
  }
  for (const [locality, number] of left.numbers) {
    const otherNumber = right.numbers.get(locality);
    if (otherNumber !== undefined && number !== otherNumber) return true;
  }
  return false;
}

function districtsCorroborate(
  left: AddressIdentity,
  right: AddressIdentity,
): boolean {
  return (
    overlaps(left.districts, right.districts) ||
    overlaps(left.municipalities, right.municipalities) ||
    (left.province === "세종" &&
      right.province === "세종" &&
      overlaps(left.neighborhoods, right.neighborhoods))
  );
}

function explicitBranch(name: string): string | null {
  const words = normalizeText(name)
    .split(/[\s\p{P}\p{S}]+/u)
    .filter(Boolean);
  const last = words[words.length - 1];
  return words.length > 1 && last.endsWith("점") ? last : null;
}

function namesPlausiblyMatch(left: string, right: string): boolean {
  const leftName = normalizeName(left);
  const rightName = normalizeName(right);
  if (!leftName || !rightName) return false;
  if (leftName === rightName) return true;

  // A separately stated branch must survive any brand expansion unchanged.
  const leftBranch = explicitBranch(left);
  const rightBranch = explicitBranch(right);
  if (leftBranch && rightBranch && leftBranch !== rightBranch) return false;
  if (leftBranch && !rightName.endsWith(leftBranch)) return false;
  if (rightBranch && !leftName.endsWith(rightBranch)) return false;

  const shorter = leftName.length <= rightName.length ? leftName : rightName;
  const longer = leftName.length <= rightName.length ? rightName : leftName;
  if ([...shorter].length >= 5 && longer.endsWith(shorter)) return true;

  // Without a branch boundary, brand insertion and a changed branch are indistinguishable.
  if (!leftBranch && !rightBranch) return false;
  // Only insertion into an otherwise intact name is accepted, not a fuzzy score.
  const shortCharacters = [...shorter];
  const longCharacters = [...longer];
  let prefix = 0;
  while (
    prefix < shortCharacters.length &&
    shortCharacters[prefix] === longCharacters[prefix]
  )
    prefix++;
  let suffix = 0;
  while (
    suffix < shortCharacters.length - prefix &&
    shortCharacters[shortCharacters.length - suffix - 1] ===
      longCharacters[longCharacters.length - suffix - 1]
  )
    suffix++;
  return (
    prefix >= 3 &&
    suffix >= 3 &&
    shorter.endsWith("점") &&
    prefix + suffix === shortCharacters.length
  );
}

function validCoordinates(lat: number | null, lng: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function within100Meters(
  store: StoreIdentity,
  candidate: PlaceCandidate,
): boolean {
  const { lat, lng } = store.position;
  if (
    !validCoordinates(lat, lng) ||
    !validCoordinates(candidate.lat, candidate.lng)
  )
    return false;
  // The shared display-distance helper rounds; identity matching needs a strict ceiling.
  const radians = Math.PI / 180;
  const latitudeDelta = (candidate.lat! - lat) * radians;
  const longitudeDelta = (candidate.lng! - lng) * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(lat * radians) *
      Math.cos(candidate.lat! * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) <= 100;
}

function validPlaceId(id: string): boolean {
  return typeof id === "string" && id.trim() === id && /^[1-9][0-9]*$/.test(id);
}

function validPlaceUrl(candidate: PlaceCandidate): boolean {
  return (
    candidate.url === `https://place.map.kakao.com/${candidate.id}` ||
    candidate.url === `https://m.place.naver.com/place/${candidate.id}/home`
  );
}

function consistent(left: PlaceCandidate, right: PlaceCandidate): boolean {
  return (
    normalizeName(left.name) === normalizeName(right.name) &&
    normalizeAddress(left.address).normalized ===
      normalizeAddress(right.address).normalized &&
    normalizePhone(left.phoneNumber) === normalizePhone(right.phoneNumber) &&
    hasInvalidPhone(left.phoneNumber) === hasInvalidPhone(right.phoneNumber) &&
    (!hasInvalidPhone(left.phoneNumber) ||
      left.phoneNumber === right.phoneNumber) &&
    left.lat === right.lat &&
    left.lng === right.lng &&
    left.url === right.url
  );
}

function candidateKey(candidate: PlaceCandidate): string {
  return JSON.stringify([
    candidate.id,
    candidate.name,
    candidate.address,
    candidate.phoneNumber,
    candidate.lat,
    candidate.lng,
    candidate.url,
  ]);
}

export function matchPlace(
  store: StoreIdentity,
  candidates: readonly PlaceCandidate[],
): PlaceMatchResult {
  if (
    !Number.isSafeInteger(store.id) ||
    store.id <= 0 ||
    !normalizeName(store.name) ||
    !store.address.trim() ||
    hasInvalidPhone(store.phoneNumber)
  )
    return { status: "unmatched", reason: "invalid-store-identity" };

  const unique = new Map<string, PlaceCandidate>();
  for (const candidate of candidates) {
    if (!validPlaceId(candidate.id)) continue;
    const previous = unique.get(candidate.id);
    if (previous && !consistent(previous, candidate)) {
      return { status: "ambiguous", reason: "conflicting-duplicate-place-id" };
    }
    if (!previous || candidateKey(candidate) < candidateKey(previous))
      unique.set(candidate.id, candidate);
  }

  const address = normalizeAddress(store.address);
  const phone = normalizePhone(store.phoneNumber);
  const matches: { candidate: PlaceCandidate; reason: string }[] = [];
  for (const candidate of unique.values()) {
    if (
      !validPlaceUrl(candidate) ||
      !normalizeName(candidate.name) ||
      hasInvalidPhone(candidate.phoneNumber)
    )
      continue;
    const candidatePhone = normalizePhone(candidate.phoneNumber);
    if (phone && candidatePhone && phone !== candidatePhone) continue;
    const candidateAddress = normalizeAddress(candidate.address);
    if (
      addressesConflict(address, candidateAddress) ||
      !districtsCorroborate(address, candidateAddress)
    )
      continue;

    const localAddress =
      overlaps(address.streets, candidateAddress.streets) ||
      overlaps(address.neighborhoods, candidateAddress.neighborhoods);
    if (
      phone &&
      phone === candidatePhone &&
      localAddress &&
      namesPlausiblyMatch(store.name, candidate.name)
    ) {
      matches.push({ candidate, reason: "phone-name-local-address" });
    } else if (
      normalizeName(store.name) === normalizeName(candidate.name) &&
      within100Meters(store, candidate)
    ) {
      matches.push({ candidate, reason: "exact-name-nearby-district" });
    }
  }
  if (matches.length > 1)
    return {
      status: "ambiguous",
      reason: "multiple-high-confidence-place-ids",
    };
  if (matches.length === 1) return { status: "matched", ...matches[0] };
  return { status: "unmatched", reason: "no-high-confidence-match" };
}
