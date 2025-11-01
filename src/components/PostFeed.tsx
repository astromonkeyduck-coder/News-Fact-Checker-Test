import React, { useEffect, useState } from "react";
import type { CardPost } from "../lib/posts/types";

interface PostFeedProps {
  endpoint?: string;
  limit?: number;
  containerId?: string;
}

export function PostFeed({ endpoint = "/.netlify/functions/posts-read", limit = 30, containerId }: PostFeedProps) {
  const [posts, setPosts] = useState<CardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${endpoint}?limit=${limit}`)
      .then((res) => res.json())
      .then((data: CardPost[]) => {
        setPosts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [endpoint, limit]);

  if (loading) {
    return <div className="post-feed-loading">Loading posts...</div>;
  }

  if (error) {
    return <div className="post-feed-error">Error loading posts: {error}</div>;
  }

  if (posts.length === 0) {
    return <div className="post-feed-empty">No posts yet.</div>;
  }

  return (
    <div className="post-feed" id={containerId}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function PostCard({ post }: { post: CardPost }) {
  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const formatStory = (text: string) => {
    // Convert \n to <br> for display
    return text.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split("\n").length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <article className="article-card" data-post-type={post.postType}>
      {post.image && (
        <div className="article-image">
          <img src={post.image} alt={post.title} loading="lazy" />
        </div>
      )}
      <div className="article-content">
        <h3 className="article-headline">
          <a href={post.link} target="_blank" rel="noopener noreferrer">
            {post.title}
          </a>
        </h3>
        <p className="article-excerpt">{formatStory(post.story)}</p>
        <div className="article-meta">
          <span className="article-date">{formatDate(post.datePosted)}</span>
          <span className="article-read-time">{post.readTime} min read</span>
        </div>
      </div>
    </article>
  );
}

// Vanilla JS integration function
export function renderPostFeed(containerId: string, endpoint = "/.netlify/functions/posts-read", limit = 30) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  container.innerHTML = '<div class="post-feed-loading">Loading posts...</div>';

  fetch(`${endpoint}?limit=${limit}`)
    .then((res) => res.json())
    .then((posts: CardPost[]) => {
      if (posts.length === 0) {
        container.innerHTML = '<div class="post-feed-empty">No posts yet.</div>';
        return;
      }

      container.innerHTML = posts
        .map((post) => {
          const formatDate = (isoString: string) => {
            try {
              return new Date(isoString).toLocaleString();
            } catch {
              return isoString;
            }
          };

          const formatStory = (text: string) => {
            // Convert \n to <br> and escape HTML
            const escaped = text
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
            return escaped.replace(/\n/g, "<br>");
          };

          const imageHtml = post.image
            ? `<div class="article-image"><img src="${post.image}" alt="${post.title.replace(/"/g, "&quot;")}" loading="lazy" /></div>`
            : "";

          return `
            <article class="article-card" data-post-type="${post.postType}">
              ${imageHtml}
              <div class="article-content">
                <h3 class="article-headline">
                  <a href="${post.link}" target="_blank" rel="noopener noreferrer">${post.title.replace(/"/g, "&quot;")}</a>
                </h3>
                <p class="article-excerpt">${formatStory(post.story)}</p>
                <div class="article-meta">
                  <span class="article-date">${formatDate(post.datePosted)}</span>
                  <span class="article-read-time">${post.readTime} min read</span>
                </div>
              </div>
            </article>
          `;
        })
        .join("");
    })
    .catch((err) => {
      container.innerHTML = `<div class="post-feed-error">Error loading posts: ${err.message}</div>`;
    });
}

