// What the PHP sites' item sheets print from several package fields, composed as the sites compose
// it (islamicart and baroqueart src/composables/sheet.js, viewer-layout RecordView), so that the
// comparison reads the same line legacy's database_item.php prints.

// Legacy's removeEndingPoint (libs.inc.php): the final periods and the spaces after them go, except
// after a "C".
export const removeEndingPoint = (s) => String(s ?? '').replace(/([^C])\.+\s*$/, '$1');

// Legacy names no country for the Palestinian museum's objects (Mus01;pa) nor for these Palestinian
// monuments; database_item.php holds the rule, and the Islamic Art site the same.
const NO_COUNTRY_PARTNER = /^mwnf3:museums:mus01:pa$/i;
const NO_COUNTRY_MONUMENTS = /^PA (01|02|03|04|05|06|07|08|09|10|11|14|18|19|20|21|24|25|26|27|28|29|30|31|32|33|34|35)$/;
export function namesCountry(item, partnerKey) {
  if (item.country_id !== 'pse') return true;
  if (item.type === 'object') return !NO_COUNTRY_PARTNER.test(partnerKey ?? '');
  if (item.type === 'monument') return !NO_COUNTRY_MONUMENTS.test(item.mwnf_reference ?? '');
  return true;
}

// The Location line: on Islamic Art a monument's address first, each of its lines kept (legacy's
// nl2br), then the location and the province without their ending period, then the country's name
// in the page's language. The package keeps each part in its own field.
export function locationLine(item, tr, { country, partnerKey, address = false } = {}) {
  const lines = address ? removeEndingPoint(String(tr.address ?? '').trim().replace(/\r\n?/g, '\n').replace(/[ \t]*\n/g, '  \n')) : '';
  return [lines, ...[tr.location, tr.province].map((part) => removeEndingPoint(part ?? ''))]
    .concat(namesCountry(item, partnerKey) ? country ?? '' : '')
    .filter(Boolean)
    .join(', ');
}

// The credit line the site prints from `credit_ids`: each person's own record, its Arabic spelling on
// an Arabic page, joined with ", ". Null when a person is not in the package: the site then prints
// the translation's joined line instead.
export function creditPeopleLine(ids, people, lang) {
  if (!ids?.length) return null;
  const names = ids.map((id) => {
    const person = people.get(id);
    if (!person) return null;
    return lang === 'ar' && person.originalname ? person.originalname : person.name ?? '';
  });
  return names.every((n) => n !== null) ? names.join(', ') : null;
}

// A collection the package marks `published: false` is kept for another page (Sharing History's
// political context), and the site lists none of them.
export const isListed = (collection) => collection?.published !== false;
