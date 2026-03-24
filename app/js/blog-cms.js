/**
 * CF-241: Blog CMS — markdown-to-HTML rendering, pagination, category filtering.
 */
(function () {
  'use strict';

  var POSTS_PER_PAGE = 6;

  /**
   * Convert structured blog content blocks to HTML.
   * @param {object[]} blocks - Content blocks from BlogPostsSEO
   * @returns {string} HTML string
   */
  function renderContentToHTML(blocks) {
    if (!blocks || !blocks.length) return '';

    return blocks.map(function (block) {
      switch (block.type) {
        case 'intro':
          return '<p class="blog-intro">' + escapeHTML(block.text) + '</p>';
        case 'heading':
          return '<h2>' + escapeHTML(block.text) + '</h2>';
        case 'paragraph':
          return '<p>' + escapeHTML(block.text) + '</p>';
        case 'list':
          return '<ul>' + block.items.map(function (item) {
            return '<li>' + escapeHTML(item) + '</li>';
          }).join('') + '</ul>';
        case 'cta':
          return '<div class="blog-cta"><p>' + escapeHTML(block.text) + '</p></div>';
        default:
          return '<p>' + escapeHTML(block.text || '') + '</p>';
      }
    }).join('\n');
  }

  /**
   * Convert simple markdown text to HTML.
   * Supports: **bold**, *italic*, [link](url), `code`, headings (#-###), lists (- item), paragraphs.
   * @param {string} markdown
   * @returns {string}
   */
  function markdownToHTML(markdown) {
    if (!markdown) return '';

    var lines = markdown.split('\n');
    var html = [];
    var inList = false;

    lines.forEach(function (line) {
      var trimmed = line.trim();

      if (!trimmed) {
        if (inList) { html.push('</ul>'); inList = false; }
        return;
      }

      // Headings
      var headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (headingMatch) {
        if (inList) { html.push('</ul>'); inList = false; }
        var level = headingMatch[1].length + 1; // h2-h4 to keep h1 for page title
        html.push('<h' + level + '>' + inlineFormat(headingMatch[2]) + '</h' + level + '>');
        return;
      }

      // List items
      if (/^[-*]\s+/.test(trimmed)) {
        if (!inList) { html.push('<ul>'); inList = true; }
        html.push('<li>' + inlineFormat(trimmed.replace(/^[-*]\s+/, '')) + '</li>');
        return;
      }

      if (inList) { html.push('</ul>'); inList = false; }
      html.push('<p>' + inlineFormat(trimmed) + '</p>');
    });

    if (inList) html.push('</ul>');
    return html.join('\n');
  }

  /**
   * Apply inline formatting: bold, italic, code, links.
   * @param {string} text
   * @returns {string}
   */
  function inlineFormat(text) {
    var escaped = escapeHTML(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/`(.+?)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    return escaped;
  }

  /**
   * Escape HTML special characters.
   * @param {string} str
   * @returns {string}
   */
  function escapeHTML(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /**
   * Paginate an array of posts.
   * @param {object[]} posts
   * @param {number} page - 1-indexed page number
   * @param {number} [perPage]
   * @returns {{ posts: object[], page: number, totalPages: number, total: number }}
   */
  function paginate(posts, page, perPage) {
    perPage = perPage || POSTS_PER_PAGE;
    var total = posts.length;
    var totalPages = Math.max(1, Math.ceil(total / perPage));
    var currentPage = Math.max(1, Math.min(page || 1, totalPages));
    var start = (currentPage - 1) * perPage;

    return {
      posts: posts.slice(start, start + perPage),
      page: currentPage,
      totalPages: totalPages,
      total: total
    };
  }

  /**
   * Filter posts by category.
   * @param {object[]} posts
   * @param {string|null} category - null returns all posts
   * @returns {object[]}
   */
  function filterByCategory(posts, category) {
    if (!category) return posts.slice();
    return posts.filter(function (p) { return p.category === category; });
  }

  /**
   * Render a blog post card (listing view).
   * @param {object} post
   * @returns {string} HTML
   */
  function renderPostCard(post) {
    return '<article class="blog-card" data-slug="' + escapeHTML(post.slug) + '">' +
      '<span class="blog-card__category">' + escapeHTML(post.category) + '</span>' +
      '<h3 class="blog-card__title"><a href="/blog/' + escapeHTML(post.slug) + '">' + escapeHTML(post.title) + '</a></h3>' +
      '<p class="blog-card__meta">' + escapeHTML(post.publishedAt) + ' &middot; ' + post.readingTimeMin + ' min read</p>' +
      '<p class="blog-card__excerpt">' + escapeHTML(post.metaDescription) + '</p>' +
      '</article>';
  }

  /**
   * Render a full blog post page.
   * @param {object} post
   * @returns {string} HTML
   */
  function renderPostPage(post) {
    return '<article class="blog-post">' +
      '<header class="blog-post__header">' +
      '<span class="blog-post__category">' + escapeHTML(post.category) + '</span>' +
      '<h1>' + escapeHTML(post.title) + '</h1>' +
      '<p class="blog-post__meta">' + escapeHTML(post.publishedAt) + ' &middot; ' + post.readingTimeMin + ' min read</p>' +
      '</header>' +
      '<div class="blog-post__content">' + renderContentToHTML(post.content) + '</div>' +
      '</article>';
  }

  /**
   * Render pagination controls.
   * @param {number} currentPage
   * @param {number} totalPages
   * @returns {string} HTML
   */
  function renderPagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    var items = [];
    items.push('<button class="pagination__btn" data-page="' + (currentPage - 1) + '"' +
      (currentPage <= 1 ? ' disabled' : '') + '>&laquo; Prev</button>');

    for (var i = 1; i <= totalPages; i++) {
      items.push('<button class="pagination__btn' + (i === currentPage ? ' pagination__btn--active' : '') +
        '" data-page="' + i + '">' + i + '</button>');
    }

    items.push('<button class="pagination__btn" data-page="' + (currentPage + 1) + '"' +
      (currentPage >= totalPages ? ' disabled' : '') + '>Next &raquo;</button>');

    return '<nav class="pagination">' + items.join('') + '</nav>';
  }

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.BlogCMS = {
    renderContentToHTML: renderContentToHTML,
    markdownToHTML: markdownToHTML,
    paginate: paginate,
    filterByCategory: filterByCategory,
    renderPostCard: renderPostCard,
    renderPostPage: renderPostPage,
    renderPagination: renderPagination
  };
})();
