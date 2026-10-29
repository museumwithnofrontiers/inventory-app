/**
 * What `extract:standalone` reads for each standalone site: the dictionary
 * words, PHP regions and tables its legacy pages print, and the entry each
 * becomes in the site's locales. See src/standalone.ts for how they are read.
 * An entry name is the site's own (`<namespace>.<entry>`) unless it is listed
 * under `overrides`, where it is a shared viewer-i18n entry the site's locale
 * overrides.
 */
import type { StandaloneSite, StandaloneWord } from './standalone.js'

/**
 * The words Discover Islamic Art's virtual exhibitions print: every one of
 * them runs on the same pages (exhibitions/ISL/generic_*.php), so their words
 * are the same, and every mini-site (one exhibition, a website of its own)
 * reads them from viewer-i18n's shared `minisite` namespace, extracted with
 * `extract:standalone -- islamicart-exhibitions --namespace minisite`.
 */
const ISLAMICART_EXHIBITION_WORDS: Record<string, string | StandaloneWord> = {
  // The window title (generic_index.php and every other page's <title>).
  'identity.windowTitle': 've_isl_windowstitle',
  // The header (#header): the logo's tooltip, the two links and the second's tooltip.
  'header.logoTip': 'back_to_home',
  'header.exhibitionsList': 'back_exhibitions_list',
  'header.home': 'back_to_section',
  'header.homeTip': 'Back_to_diaHome',
  // The home page's menu (generic_index.php) and partner band (generic_homelogo.php).
  'home.introduction': 'exh_introduction',
  'home.curatedBy': 'exhibition_partners_produced',
  // The navigation over the introduction and every exhibition page.
  'nav.entrance': 'exh_back_entrance',
  'nav.previous': 'Previous page',
  'nav.next': 'Next page',
  // The introduction's map (generic_introduction.php).
  'intro.enlargeMap': 'enlargethemap',
  // The item panel (generic_exhibition.php): the tooltips and the link to the sheet.
  'item.showZoom': 'showzoom',
  'item.showDetail': 'showdetail',
  'item.moreInfo': 'moreinfo_item',
  // The download block under every text.
  'download.heading': 'gn_download',
  'download.asPdf': 'gn_aspdf_img',
  'download.asWord': 'gn_asword_txt',
  // The menu over the footer (generic_footerTop.php), in its order.
  'menu.permanentCollection': 'PermanentCollection',
  'menu.database': 'home_database',
  'menu.exhibitions': 'home_exhibitions',
  'menu.artisticIntroduction': 'home_artistic_intro',
  'menu.timeline': 'timeline_header',
  'menu.partners': 'home_partnermuseums',
  'menu.myCollection': 'my_museum',
  // The footer, in its order; the year follows the copyright. Legacy's
  // language-policy link prints no text (its tag is never closed), so it is
  // not read.
  'footer.aboutMwnf': 'footer1',
  'footer.contact': 'footer2',
  'footer.legalNotice': 'footer3',
  'footer.credits': 'footer4',
  'footer.cookies': 'cookie_policy',
  'footer.copyright': 'footer5',
}

/**
 * The words Discover Baroque Art's virtual exhibitions print. Their pages
 * (exhibitions/BAR/generic_*.php) are built like Discover Islamic Art's, but
 * Baroque Art is a product of its own, so its mini-sites read a set of their
 * own — viewer-i18n's `minisiteBaroque` namespace, extracted with
 * `extract:standalone -- baroqueart-exhibitions --namespace minisiteBaroque`
 * — complete, even where a word is also ISL's. The entries are named as
 * ISL's, so the mini-site pages read either set; Baroque Art adds the home
 * band's cooperation and design lines, and its menu has no Artistic
 * Introduction.
 */
const BAROQUEART_EXHIBITION_WORDS: Record<string, string | StandaloneWord> = {
  // The window title (generic_index.php and every other page's <title>).
  'identity.windowTitle': 've_bar_windowstitle',
  // The header (#header): the logo's tooltip, the two links and the second's tooltip.
  'header.logoTip': 'back_to_home',
  'header.exhibitionsList': 'back_exhibitions_list',
  'header.home': 'back_to_section',
  'header.homeTip': 'Back_to_dbaHome',
  // The home page's menu (generic_index.php) and band (generic_homelogo.php), in its order.
  'home.introduction': 'exh_introduction',
  'home.curatedBy': 'exhibition_curated_baroqueart',
  'home.cooperation': 'exhibition_curated_baroqueart_cooperation',
  'home.partnerInstitutions': 'exhibition_curated_baroqueart_partner',
  'home.design': 'exhibition_curated_baroqueart_design',
  // The navigation over the introduction and every exhibition page.
  'nav.entrance': 'exh_back_entrance',
  'nav.previous': 'Previous page',
  'nav.next': 'Next page',
  // The introduction's map (generic_introduction.php).
  'intro.enlargeMap': 'enlargethemap',
  // The item panel (generic_exhibition.php): the tooltips and the link to the sheet.
  'item.showZoom': 'showzoom',
  'item.showDetail': 'showdetail',
  'item.moreInfo': 'moreinfo_item',
  // The download block under every text.
  'download.heading': 'gn_download',
  'download.asPdf': 'gn_aspdf_img',
  'download.asWord': 'gn_asword_txt',
  // The menu over the footer (generic_footerTop.php), in its order.
  'menu.permanentCollection': 'PermanentCollection',
  'menu.database': 'home_database',
  'menu.exhibitions': 'home_exhibitions',
  'menu.timeline': 'timeline_header',
  'menu.partners': 'home_partnermuseums',
  'menu.myCollection': 'my_museum',
  // The footer, in its order; the year follows the copyright. Unlike ISL's,
  // Baroque Art's language-policy link is closed, so it prints its text.
  'footer.aboutMwnf': 'footer1',
  'footer.contact': 'footer2',
  'footer.legalNotice': 'footer3',
  'footer.credits': 'footer4',
  'footer.languagePolicy': 'language_policy',
  'footer.cookies': 'cookie_policy',
  'footer.copyright': 'footer5',
}

export const STANDALONE_SITES: Record<string, StandaloneSite> = {
  islamicart: {
    root: 'islamicart/www.discoverislamicart.org',
    host: 'https://islamicart.museumwnf.org',
    // includes/header_bottom.php's switcher: $INTERFACELNGLIST.
    languages: ['ar', 'en', 'es', 'fr'],
    words: {
      // The page title, and the heading over every inner page (header_bottom.php).
      'identity.title': 'dia_gn_title',
      'identity.heading': 'db_partner_ISL',
      // The header's links (header.php, header_bottom.php).
      'nav.portal': 'portal_link',
      'nav.home': 'back_to_section',
      // The menu (header_bottom.php), in its order.
      'nav.permanentCollection': 'PermanentCollection',
      'nav.database': 'home_database',
      'nav.exhibitions': 'home_exhibitions',
      'nav.artisticIntroduction': 'home_artistic_intro',
      'nav.partners': 'home_partnermuseums',
      'nav.timeline': 'timeline_header',
      'nav.dynasties': 'IslDyn_header',
      'nav.myCollection': 'my_museum',
      // The banner over each section (SectionTitle() on each page).
      'section.permanentCollection': 'museum_home_pc',
      'section.database': 'museum_home_db',
      'section.partners': 'museum_home_pm_partners',
      // The home page's left column (diaTemplates/leftLink.php).
      'home.recommendedLinks': 'home_recommendedlinks',
      'home.credits': 'footer4',
      'home.missionStatement': 'mission_statement',
      'home.visit': 'dia_home_visit',
      'home.explore': 'dia_home_EIAC',
      'home.exploreTooltip': 'pm_EIAC_subtitle',
      // Today's highlight (diaTemplates/randomText.php).
      'home.highlight': 'index_today',
      'home.alsoKnownAs': 'db_alsoknowas',
      'home.viewDescription': 'view_description',
      // The sponsor band (diaTemplates/bottomSection1.php, bottomSection2.php),
      // and the European Union's text its logo opens (explenation_text_home.php).
      'sponsors.supportHead': 'dia_supporttexthead',
      'sponsors.supportText': 'dia_supporttext',
      'sponsors.exploreHead': 'dia_supporttexthead2',
      'sponsors.exploreText': 'dia_supporttext2',
      'sponsors.europeanUnion': 'DatabaseEuOver',
      // The footer (includes/footer.php), in its order; the year follows the copyright.
      'footer.aboutMwnf': 'footer1',
      'footer.contact': 'footer2',
      'footer.legalNotice': 'footer3',
      'footer.credits': 'footer4',
      'footer.languagePolicy': 'language_policy',
      'footer.cookies': 'cookie_policy',
      'footer.copyright': 'footer5',
      // The item sheet (database_item.php, modules/database_item.php). Its
      // first row's label is a `db_` word of group 4, the module's own.
      'item.nameOfObject': { word: 'db_name_object', groups: [4] },
      'item.nameOfMonument': { word: 'db_name_monument', groups: [4] },
      'item.back': 'back',
      'item.collectionStart': 'pc_start_page',
      'item.relatedContent': 'gn_related_context',
      'item.relatedObjects': 'item_relatedobjects',
      'item.relatedMonuments': 'item_linkedmonuments',
      'item.timeline': 'pc_view_hcr_item',
      'item.dynasties': 'pc_linkeddynasties',
      'item.relatedVideos': 'related_video',
      'item.onDisplayIn': 'on_display_in',
      'item.exhibitions': 'gn_exhibitions',
      'item.galleries': 'gn_galleries',
      'item.download': 'gn_download',
      'item.asPdf': 'gn_aspdf_img',
      // The Mission Statement page (isl_missionstatement.php): its banner, its
      // text (read from group 3 alone) and the print link.
      'missionStatement.title': 'missionstatement',
      'missionStatement.body': { word: 'mission_statement_text', groups: [3] },
      'page.print': 'print',
      // The Islamic Dynasties section (legacy's /dynasties/ client): its own
      // dictionary group, 61.
      'dynasties.title': { word: 'IslDyn_header', groups: [61] },
      'dynasties.intro': { word: 'dynastiesIntro', groups: [61] },
      'dynasties.pick': { word: 'IslDyn_dropdown', groups: [61] },
      'dynasties.go': { word: 'my_go', groups: [61] },
      'dynasties.startPage': { word: 'IslDyn_return StartPage', groups: [61] },
      'dynasties.relatedObjectsFor': { word: 'islDyn_RelObjFor', groups: [61] },
      'dynasties.relatedMonumentsFor': { word: 'islDyn_relMonFor', groups: [61] },
    },
    overrides: {
      // The sheet's toggle (database_item.php's `.tag`), printed by viewer-layout's RecordSheet.
      'record.action.viewShortDescription': 'pc_view_sdesc',
      'record.action.hideShortDescription': 'pc_hide_sdesc',
    },
    regions: {
      // recommendedlinks.php: every group heading and link, from the first
      // heading to the end of the page's content.
      'recommendedLinks.body': {
        file: 'recommendedlinks.php',
        start: '<div class="short_heading">',
        end: '</section>',
        language: 'en',
        // The one constant the region echoes, as the live page prints it.
        constants: { EXPLORE_WEBSITE_URL: 'https://explore.museumwnf.org' },
      },
    },
  },

  baroqueart: {
    root: 'baroqueart/www.discoverbaroqueart.org',
    host: 'https://baroqueart.museumwnf.org',
    // libs/config.inc.php: $LNGLIST = array("en"). The other languages' rows
    // of its words are never printed.
    languages: ['en'],
    words: {
      // The page title, and the heading over every inner page (header_bottom.php).
      'identity.title': 'dba_gn_meta_title',
      'identity.heading': 'db_partner_BAR',
      // The header's links (dbaTemplates/header.php, includes/header_bottom.php).
      'nav.portal': 'portal_link',
      'nav.home': 'back_to_section',
      // The menu (index.php, includes/header_bottom.php), in its order.
      'nav.permanentCollection': 'home_permanentcollection',
      'nav.database': 'home_database',
      'nav.exhibitions': 'home_exhibitions',
      'nav.partners': 'home_partnermuseums',
      'nav.timeline': 'timeline_header',
      'nav.myCollection': 'my_museum',
      // The banner over each section (SectionTitle() on each page).
      'section.permanentCollection': 'museum_home_pc',
      'section.database': 'museum_home_db',
      'section.partners': 'museum_home_pm_partners',
      // The home page's left column (dbaTemplates/leftLink.php): one link.
      'home.credits': 'footer4',
      // Today's highlight (dbaTemplates/randomText.php).
      'home.highlight': 'index_today',
      'home.alsoKnownAs': 'db_alsoknowas',
      'home.viewDescription': 'view_description',
      // The footer's copyright line (includes/footer.php); the year follows it.
      'footer.copyright': 'footer5',
      // The home page's band (dbaTemplates/bottomSection1.php): the two words
      // printed one after the other, the country names linked to partners.php.
      'home.cooperation': { word: 'dba_supporttexthead', words: ['dba_supporttexthead', 'dba_support_text'] },
      // The Partners entrance (partners.php): the About popup and the Sponsors link.
      'partner.about': { word: 'PartnerMuseumIntro_DBA', groups: [4] },
      'partner.sponsors': 'pm_home_sponsors',
      // The Sponsors page (atrium_sponsor_detail.php?flg=local).
      'sponsors.title': 'submenu1_4',
      'sponsors.localHeading': 'local_Sponsors',
    },
    overrides: {
      // The footer's links (includes/footer.php), in legacy's words.
      'core.footer.aboutMwnf': 'footer1',
      'core.footer.contact': 'footer2',
      'core.footer.legalNotice': 'footer3',
      'core.footer.credits': 'footer4',
      'core.footer.languagePolicy': 'language_policy',
      'core.footer.cookies': 'cookie_policy',
    },
    regions: {
      // mwnf_credit.php: the page's text, from its heading to the duplicate
      // block legacy keeps for small screens; the back link is above the start.
      'credits.body': {
        file: 'mwnf_credit.php',
        start: '<div class="short_heading">',
        end: '<!--Mobile Version -->',
        language: 'en',
      },
    },
    links: { 'partners.php': '#/partners' },
    tables: ['baroqueartSponsors'],
  },

  sharinghistory: {
    root: 'sharinghistory/www.sharinghistory.org',
    host: 'https://sharinghistory.museumwnf.org',
    // libs/config.inc.php: $LNGLIST = array("en").
    languages: ['en'],
    // The site's pages read group 13, its own, with 2 and 3.
    groups: [2, 3, 13],
    words: {
      // The page title; the heading and its line over every inner page, and
      // over the home page's picture (includes/header_bottom.php,
      // shTemplates/bannerText.php).
      'identity.pageTitle': 'sh_gn_meta_title',
      'identity.heading': 'sh_home_heading1',
      'identity.subheading': 'sh_home_heading2',
      // The header's links (shTemplates/header.php, includes/header_bottom.php).
      'nav.portal': 'portal_link',
      'nav.home': 'back_to_section',
      // The menu (shTemplates/menuSH.php), in its order, with its drop-downs.
      'nav.introduction': 'sh_menu_introduction',
      'nav.aboutProject': 'sh_about_project',
      'nav.historicalBackground': 'sh_about_hb',
      'nav.exhibitions': 'home_exhibitions',
      'nav.permanentCollection': 'sh_home_pc',
      'nav.database': 'home_database',
      'nav.timeline': 'sh_menu_timeline',
      'nav.historicalProfiles': 'sh_menu_hb',
      'nav.partners': 'sh_home_partners',
      'nav.myCollection': 'my_museum',
      // The home page's exhibitions (shTemplates/exhibitionListImg.php).
      'home.exhibitionsCaption': 'sh_home_exh_img_text',
      // The banner over each section (each page's <h2><span>).
      'section.permanentCollection': 'sh_museum_home_pc',
      'section.database': 'sh_home_db',
      'section.partners': 'sh_pm_partners',
      'section.historicalBackground': 'sh_historical_background',
      'section.bibliography': 'sh_menu_bibliography',
      // The item sheet's institution lines (modules/database_item.php): an
      // object's holding institution in its own language, a monument's
      // institution and its responsible institution in its own language.
      'sheet.holdingInstitutionOriginal': 'sh_db_holdinginstitutionorg',
      'sheet.institution': 'sh_db_institution',
      'sheet.responsibleInstitutionOriginal': 'sh_db_responsibleinstitutionorg',
      // The footer (includes/footer.php); the year follows the copyright.
      'footer.aboutMwnf': 'footer1',
      'footer.contact': 'footer2',
      'footer.legalNotice': 'footer3',
      'footer.credits': 'footer4',
      'footer.languagePolicy': 'language_policy',
      'footer.cookies': 'cookie_policy',
      'footer.copyright': 'footer5',
      // The cooperation band (includes/inner_bottom.php).
      'band.cooperation': 'sh_supporttext_top',
      'band.leagueOfArabStates': 'sh_logo_las_mouse_over',
      'band.partnersTitle': 'sh_home_heading1',
      'band.partnerInstitutions': 'sh_partner_institution',
      'band.partnersTooltip': 'sh_partners_tool_tip',
      'band.strategicSponsors': 'sh_strategic_sponsors',
      'band.sponsorSharjah': 'sh_partner1',
      'band.sponsorYasar': 'sh_partner2',
      'band.otherSponsors': 'sh_other_sponsors',
      'band.support': 'sh_support',
      'band.partnerMeetingsVideo': 'sh_view_partner_meet_footer',
      'band.partnerMeetingsVideoTooltip': 'sh_view_partner_meet_footer_mouse_over',
      // The About pages (about.php, about_team.php): the banner, the tab
      // strip, the headings and the related content.
      'about.bannerTitle': 'sh_about_project',
      'about.tabTeam': 'sh_team',
      'about.tabChronology': 'sh_chronology',
      'about.tabAbout': 'sh_ex_about',
      'about.seeAlsoHistoricalBackground': 'sh_see_also_hb',
      'about.heading': 'sh_home_heading1',
      'about.relatedContent': 'sh_related_context',
      'about.relatedSpeech': 'sh_about_related_content1',
      'about.relatedVideo': 'sh_about_related_content',
      'team.heading': 'sh_team_head',
      // The Sponsors pages (sponsor_detail.php, sponsor_detail_local.php).
      'sponsors.bannerTitle': 'submenu1_4',
      'sponsors.international': 'international_Sponsors',
      'sponsors.local': 'local_Sponsors',
      'sponsors.localIntro': 'sponsors_head_local_text',
      'sponsors.partnersLink': 'sh_partner_link',
    },
    links: { 'pm_partner_list.php': '#/partners' },
    tables: ['sharinghistoryAbout', 'sharinghistoryTeam', 'sharinghistorySponsors'],
  },

  'islamicart-exhibitions': {
    root: 'islamicart/www.discoverislamicart.org',
    host: 'https://islamicart.museumwnf.org',
    // exhibitions/ISL/libs/config.inc.php: $LNGLIST.
    languages: ['en', 'fr', 'ar', 'es', 'pt', 'it', 'de', 'tr', 'se'],
    // The exhibition pages read group 6 ($TRSL_GROUP), with 2 and 3.
    groups: [2, 3, 6],
    words: ISLAMICART_EXHIBITION_WORDS,
  },

  'baroqueart-exhibitions': {
    root: 'baroqueart/www.discoverbaroqueart.org',
    host: 'https://baroqueart.museumwnf.org',
    // exhibitions/BAR/libs/config.inc.php: $LNGLIST, English; Reformation's
    // own (reformation/libs/config.inc.php) adds Italian.
    languages: ['en', 'it'],
    // The exhibition pages read group 6 ($TRSL_GROUP), with 2 and 3.
    groups: [2, 3, 6],
    words: BAROQUEART_EXHIBITION_WORDS,
  },
}