(function() {
  // Helper functions to convert text into HTML paragraphs.
  function convertToParagraphs(text) {
    const paragraphs = text.split(/\r?\n+/).filter(line => line.trim() !== '');
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('');
  }

  function getTruncatedParagraphs(text) {
    const paragraphs = text.split(/\r?\n+/).filter(line => line.trim() !== '');
    if (paragraphs.length <= 1) {
      return convertToParagraphs(text);
    } else {
      const halfCount = Math.floor(paragraphs.length / 2);
      const truncated = paragraphs.slice(0, halfCount);
      if (paragraphs.length > halfCount) {
        truncated[truncated.length - 1] += '...';
      }
      return truncated.map(p => `<p>${p.trim()}</p>`).join('');
    }
  }

  // Animate description changes.
  function animateDescription(descContainer, newContentHTML, expanding) {
    const content = descContainer.querySelector('.description-content');
    descContainer.style.maxHeight = content.scrollHeight + 'px';
    content.innerHTML = newContentHTML;
    // Force reflow.
    void descContainer.offsetHeight;
    const targetHeight = content.scrollHeight;
    descContainer.style.maxHeight = targetHeight + 'px';
    descContainer.addEventListener('transitionend', function handler() {
      if (expanding) {
        descContainer.style.maxHeight = 'auto';
      }
      descContainer.removeEventListener('transitionend', handler);
    });
  }

  /**
   * Initializes an RSS feed on the page.
   * @param {string} containerId - The ID of the container where the feed will be displayed.
   * @param {string} paginationId - The ID of the container for pagination controls.
   * @param {string} feedUrl - The URL of the RSS feed.
   * @param {number} [itemsPerPage=5] - Number of feed items per page.
   */
  function initRSSFeed(containerId, paginationId, feedUrl, itemsPerPage = 5) {
    let currentPage = 1;
    let feedItemsData = [];
    let totalPages = 0;

    function renderPage(page) {
      const feedContainer = document.getElementById(containerId);
      feedContainer.innerHTML = '';
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageItems = feedItemsData.slice(startIndex, endIndex);

      pageItems.forEach(data => {
        const feedItem = document.createElement('div');
        feedItem.classList.add('feed-item');

        const tagsHTML = data.categories.length
          ? data.categories.map(cat => `<div class="tag">${cat}</div>`).join('')
          : '';

        feedItem.innerHTML = `
          <div class="tags">${tagsHTML}</div>
          <h2>${data.title}</h2>
          <div class="date-share">
            <div class="date">${data.pubDate}</div>
            <div class="share-icons">
              <a class="share-icon facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.link)}" target="_blank" title="Share on Facebook">
                <i class="fab fa-facebook-f"></i>
              </a>
              <a class="share-icon twitter" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(data.title)}" target="_blank" title="Share on X">
                <i class="fab fa-twitter"></i>
              </a>
            </div>
          </div>
          <hr class="separator">
          <div class="description">
            <div class="description-content">
              ${data.truncatedDescriptionHTML}
            </div>
          </div>
          <div class="source">
            <span class="source-label">Source: </span>
            <span class="source-content">${data.source}</span>
          </div>
          <div class="button-container">
            <button class="toggle-description">Read full article</button>
          </div>
        `;
        feedContainer.appendChild(feedItem);
        const descContainer = feedItem.querySelector('.description');
        descContainer.style.maxHeight = descContainer.querySelector('.description-content').scrollHeight + 'px';

        const toggleButton = feedItem.querySelector('.toggle-description');
        toggleButton.addEventListener('click', () => {
          const expanding = toggleButton.textContent === 'Read full article';
          animateDescription(
            descContainer,
            expanding ? data.fullDescriptionHTML : data.truncatedDescriptionHTML,
            expanding
          );
          toggleButton.textContent = expanding ? 'Close' : 'Read full article';
        });
      });
    }

    function updatePaginationControls() {
      const paginationContainer = document.getElementById(paginationId);
      paginationContainer.innerHTML = '';

      const prevButton = document.createElement('button');
      prevButton.textContent = '<';
      if (currentPage === 1) prevButton.classList.add('disabled');
      prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          renderPage(currentPage);
          updatePaginationControls();
        }
      });
      paginationContainer.appendChild(prevButton);

      for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) pageButton.classList.add('active');
        pageButton.addEventListener('click', () => {
          currentPage = i;
          renderPage(currentPage);
          updatePaginationControls();
        });
        paginationContainer.appendChild(pageButton);
      }

      const nextButton = document.createElement('button');
      nextButton.textContent = '>';
      if (currentPage === totalPages) nextButton.classList.add('disabled');
      nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
          currentPage++;
          renderPage(currentPage);
          updatePaginationControls();
        }
      });
      paginationContainer.appendChild(nextButton);
    }

    // Fetch and parse the RSS feed.
    fetch(feedUrl)
      .then(response => response.text())
      .then(str => {
        const parser = new DOMParser();
        const xml = parser.parseFromString(str, "application/xml");
        const items = xml.querySelectorAll('item');
        items.forEach(item => {
          const title = item.querySelector('title')?.textContent || 'No Title';
          const description = item.querySelector('description')?.textContent || 'No Description';
          const link = item.querySelector('link')?.textContent || '#';
          const categoryText = item.querySelector('category')?.textContent || '';
          const categories = categoryText.split(',').map(cat => cat.trim()).filter(Boolean);
          const rawPubDate = item.querySelector('pubDate')?.textContent;
          const formattedPubDate = rawPubDate
            ? new Date(rawPubDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
            : 'No Date';
          const source = item.querySelector('link')?.textContent || 'No source';
          const fullDescriptionHTML = convertToParagraphs(description);
          const truncatedDescriptionHTML = getTruncatedParagraphs(description);
          feedItemsData.push({
            title,
            fullDescriptionHTML,
            truncatedDescriptionHTML,
            pubDate: formattedPubDate,
            source,
            link,
            categories
          });
        });
        totalPages = Math.ceil(feedItemsData.length / itemsPerPage);
        renderPage(currentPage);
        updatePaginationControls();
      })
      .catch(error => {
        console.error('Error fetching RSS feed:', error);
        const feedContainer = document.getElementById(containerId);
        feedContainer.innerHTML = '<p>Error loading feed.</p>';
      });
  }

  // Expose the init function so it can be called from the HTML page.
  window.initRSSFeed = initRSSFeed;
})();
