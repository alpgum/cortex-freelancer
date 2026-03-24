// CF-241: Blog Engine with CMS-like Structure
(function() {
  'use strict';

  function BlogEngine(options) {
    options = options || {};
    this.postsPerPage = options.postsPerPage || 10;
    this.container = options.container || null;
    this.posts = [];
    this.currentPage = 1;
    this.currentCategory = null;
    this.searchQuery = '';
  }

  BlogEngine.prototype.init = function(posts) {
    this.posts = posts || [];
    this.posts.sort(function(a, b) {
      return new Date(b.publishDate) - new Date(a.publishDate);
    });
    return this;
  };

  BlogEngine.prototype._getFilteredPosts = function() {
    var filtered = this.posts;
    var self = this;

    if (this.currentCategory) {
      filtered = filtered.filter(function(post) {
        return post.category === self.currentCategory;
      });
    }

    if (this.searchQuery) {
      var q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(function(post) {
        return post.title.toLowerCase().indexOf(q) !== -1 ||
               post.metaDescription.toLowerCase().indexOf(q) !== -1 ||
               post.keywords.some(function(k) { return k.toLowerCase().indexOf(q) !== -1; });
      });
    }

    return filtered;
  };

  BlogEngine.prototype.getTotalPages = function() {
    var filtered = this._getFilteredPosts();
    return Math.max(1, Math.ceil(filtered.length / this.postsPerPage));
  };

  BlogEngine.prototype.getPage = function(page) {
    var filtered = this._getFilteredPosts();
    var totalPages = this.getTotalPages();
    page = Math.max(1, Math.min(page, totalPages));
    this.currentPage = page;

    var start = (page - 1) * this.postsPerPage;
    var end = start + this.postsPerPage;

    return {
      posts: filtered.slice(start, end),
      currentPage: page,
      totalPages: totalPages,
      totalPosts: filtered.length,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  };

  BlogEngine.prototype.setCategory = function(category) {
    this.currentCategory = category || null;
    this.currentPage = 1;
    return this;
  };

  BlogEngine.prototype.setSearch = function(query) {
    this.searchQuery = query || '';
    this.currentPage = 1;
    return this;
  };

  BlogEngine.prototype.getCategories = function() {
    var cats = {};
    this.posts.forEach(function(post) {
      if (!cats[post.category]) {
        cats[post.category] = { count: 0, label: post.category.replace(/-/g, ' ') };
      }
      cats[post.category].count++;
    });
    return cats;
  };

  BlogEngine.prototype._renderMarkdown = function(content) {
    // Simple markdown to HTML renderer
    var html = content;

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Tables (basic)
    html = html.replace(/^\|(.+)\|$/gm, function(match, content) {
      var cells = content.split('|').map(function(cell) { return cell.trim(); });
      var row = cells.map(function(cell) {
        if (/^[-:]+$/.test(cell)) return null;
        return '<td>' + cell + '</td>';
      });
      if (row.indexOf(null) !== -1) return '';
      return '<tr>' + row.join('') + '</tr>';
    });

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Paragraphs
    html = html.replace(/\n\n([^<])/g, '</p><p>$1');

    // Code blocks
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    return html;
  };

  BlogEngine.prototype.renderPost = function(post) {
    if (!post) return '';

    var meta = '<div class="blog-post-meta">' +
      '<time datetime="' + post.publishDate + '">' + this._formatDate(post.publishDate) + '</time>' +
      '<span class="blog-post-category">' + post.category + '</span>' +
      '</div>';

    var content = this._renderMarkdown(post.content);

    var keywords = '<div class="blog-post-keywords">' +
      post.keywords.map(function(kw) {
        return '<span class="keyword-tag">' + kw + '</span>';
      }).join('') +
      '</div>';

    return '<article class="blog-post" data-slug="' + post.slug + '">' +
      meta +
      '<div class="blog-post-content">' + content + '</div>' +
      keywords +
      '</article>';
  };

  BlogEngine.prototype.renderPostCard = function(post) {
    return '<div class="blog-card" data-slug="' + post.slug + '">' +
      '<h2 class="blog-card-title"><a href="/blog/' + post.slug + '">' + post.title + '</a></h2>' +
      '<div class="blog-card-meta">' +
        '<time datetime="' + post.publishDate + '">' + this._formatDate(post.publishDate) + '</time>' +
        '<span class="blog-card-category">' + post.category + '</span>' +
      '</div>' +
      '<p class="blog-card-excerpt">' + post.metaDescription + '</p>' +
      '<a href="/blog/' + post.slug + '" class="blog-card-link">Read more</a>' +
      '</div>';
  };

  BlogEngine.prototype.renderIndex = function(page) {
    var pageData = this.getPage(page || this.currentPage);
    var self = this;

    var header = '<div class="blog-header">' +
      '<h1>Cortex Freelancer Blog</h1>' +
      '<p>Tips, guides, and strategies for freelancers on Upwork</p>' +
      '</div>';

    var search = '<div class="blog-search">' +
      '<input type="text" id="blog-search-input" placeholder="Search articles..." value="' + (this.searchQuery || '') + '">' +
      '</div>';

    var categories = this._renderCategoryFilter();

    var cards = pageData.posts.map(function(post) {
      return self.renderPostCard(post);
    }).join('');

    var pagination = this._renderPagination(pageData);

    return header + search + categories +
      '<div class="blog-grid">' + cards + '</div>' +
      pagination;
  };

  BlogEngine.prototype._renderCategoryFilter = function() {
    var cats = this.getCategories();
    var self = this;
    var buttons = '<button class="category-btn' + (!this.currentCategory ? ' active' : '') + '" data-category="">All</button>';

    Object.keys(cats).forEach(function(cat) {
      var isActive = self.currentCategory === cat ? ' active' : '';
      buttons += '<button class="category-btn' + isActive + '" data-category="' + cat + '">' +
        cats[cat].label + ' (' + cats[cat].count + ')</button>';
    });

    return '<div class="blog-categories">' + buttons + '</div>';
  };

  BlogEngine.prototype._renderPagination = function(pageData) {
    if (pageData.totalPages <= 1) return '';

    var html = '<nav class="blog-pagination">';

    if (pageData.hasPrev) {
      html += '<button class="page-btn" data-page="' + (pageData.currentPage - 1) + '">Previous</button>';
    }

    for (var i = 1; i <= pageData.totalPages; i++) {
      var active = i === pageData.currentPage ? ' active' : '';
      html += '<button class="page-btn' + active + '" data-page="' + i + '">' + i + '</button>';
    }

    if (pageData.hasNext) {
      html += '<button class="page-btn" data-page="' + (pageData.currentPage + 1) + '">Next</button>';
    }

    html += '</nav>';
    return html;
  };

  BlogEngine.prototype._formatDate = function(dateStr) {
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    var d = new Date(dateStr + 'T00:00:00');
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  };

  BlogEngine.prototype.mount = function(containerEl) {
    this.container = containerEl;
    var self = this;

    this.container.innerHTML = this.renderIndex();

    this.container.addEventListener('click', function(e) {
      var categoryBtn = e.target.closest('.category-btn');
      if (categoryBtn) {
        self.setCategory(categoryBtn.dataset.category || null);
        self.container.innerHTML = self.renderIndex();
        return;
      }

      var pageBtn = e.target.closest('.page-btn');
      if (pageBtn) {
        var page = parseInt(pageBtn.dataset.page, 10);
        self.container.innerHTML = self.renderIndex(page);
        self.container.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    });

    var searchInput = this.container.querySelector('#blog-search-input');
    if (searchInput) {
      var debounceTimer;
      searchInput.addEventListener('input', function(e) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          self.setSearch(e.target.value);
          self.container.innerHTML = self.renderIndex();
          var input = self.container.querySelector('#blog-search-input');
          if (input) {
            input.focus();
            input.selectionStart = input.selectionEnd = input.value.length;
          }
        }, 300);
      });
    }

    return this;
  };

  BlogEngine.prototype.generateSitemap = function(baseUrl) {
    var urls = this.posts.map(function(post) {
      return '<url>' +
        '<loc>' + baseUrl + '/blog/' + post.slug + '</loc>' +
        '<lastmod>' + post.publishDate + '</lastmod>' +
        '<changefreq>monthly</changefreq>' +
        '<priority>0.7</priority>' +
        '</url>';
    });

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '<url><loc>' + baseUrl + '/blog</loc><priority>0.8</priority></url>\n' +
      urls.join('\n') +
      '\n</urlset>';
  };

  BlogEngine.prototype.generateRSSFeed = function(baseUrl) {
    var items = this.posts.slice(0, 20).map(function(post) {
      return '<item>' +
        '<title>' + post.title + '</title>' +
        '<link>' + baseUrl + '/blog/' + post.slug + '</link>' +
        '<description>' + post.metaDescription + '</description>' +
        '<pubDate>' + new Date(post.publishDate + 'T00:00:00').toUTCString() + '</pubDate>' +
        '<guid>' + baseUrl + '/blog/' + post.slug + '</guid>' +
        '<category>' + post.category + '</category>' +
        '</item>';
    });

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0">\n<channel>\n' +
      '<title>Cortex Freelancer Blog</title>\n' +
      '<link>' + baseUrl + '/blog</link>\n' +
      '<description>Tips, guides, and strategies for freelancers</description>\n' +
      items.join('\n') +
      '\n</channel>\n</rss>';
  };

  window.CortexFreelancer = window.CortexFreelancer || {};
  window.CortexFreelancer.BlogEngine = BlogEngine;
})();
