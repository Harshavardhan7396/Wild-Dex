import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface Post {
  id: string;
  author: {
    name: string;
    avatar: string;
    location: string;
    badge: string;
  };
  timeAgo: string;
  species: {
    id: string;
    commonName: string;
    scientificName: string;
    photoUrl: string;
    matchScore: number;
    category: string;
    status: string;
  };
  caption: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export const FeedPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'circle' | 'regional' | 'global'>('circle');
  const [toast, setToast] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([
    {
      id: 'post-1',
      author: {
        name: 'Leo Brooks',
        avatar:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ',
        location: 'Olympic National Forest, WA',
        badge: 'Field Biologist',
      },
      timeAgo: '15m ago',
      species: {
        id: 'pacific-banana-slug',
        commonName: 'Pacific Banana Slug',
        scientificName: 'Ariolimax columbianus',
        photoUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDU0JDWRLzy8ntcDNfpJFWsQG2o69z_9_EMlLhjFXsxC0O5596bTlXKNKOC8pWAamTK44Vm1YN_uxdZAZYWp84dfKipiQob1Y5KPIvHi-roeWmY778XcuoBQMEek9iYLWzFzD6E0LAVbhvsJXaxWACE66-uhZSRhT7ntdigDavcq8BYhzUuGBX-0NoNeyKvBuBsy70TeQdNNLNTWKuID6u1Oc_apm-6nS9oJTRwQrp-xwWrOeBP47Cyaw',
        matchScore: 98.4,
        category: 'Native Wild',
        status: 'Common, Not in Danger',
      },
      caption:
        'Spotted this 19cm banana slug along the mossy Hoh River trail after steady morning drizzle! Busy breaking down dead hemlock needles.',
      likes: 42,
      comments: 7,
      isLiked: false,
      isSaved: false,
    },
    {
      id: 'post-2',
      author: {
        name: 'Dr. Aris Thorne',
        avatar:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ',
        location: 'Cascade Mountain Ridge',
        badge: 'Herpetologist',
      },
      timeAgo: '2h ago',
      species: {
        id: 'olympic-torrent-salamander',
        commonName: 'Olympic Torrent Salamander',
        scientificName: 'Rhyacotriton olympicus',
        photoUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuCVKfVgaeEnOB_EROdsa-uaYpal176ydPH1WyThBlysv89I-Dex_CkzyTDdwLrZL2_xF1InN1wawIGbRe8c7vXojByBAqbLYkjIlzOzAumRec91MP_2b48Lgfcmf9cwyVUGasLfkBQE0oOD5juGB6sQQJQpxYpYJUL2Mt1TWaDM02TtW4k8iq-fcVipFvMkzuHjB-S60-Q78qISae0IOC_Yr6IDl26bsxOzN2h29p3okHvIjBwoPmjjRg',
        matchScore: 99.2,
        category: 'Amphibia',
        status: 'At Risk',
      },
      caption:
        'Confirmed clear cold splash-zone home in the rocks at 820m elevation. Notice the bright yellow belly wash and distinct square snout profile.',
      likes: 89,
      comments: 14,
      isLiked: true,
      isSaved: true,
    },
    {
      id: 'post-3',
      author: {
        name: 'Chloe Rivera',
        avatar:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ',
        location: 'Willamette River Meadow',
        badge: 'Botanist',
      },
      timeAgo: '5h ago',
      species: {
        id: 'monarch-butterfly',
        commonName: 'Monarch Butterfly',
        scientificName: 'Danaus plexippus',
        photoUrl:
          'https://lh3.googleusercontent.com/aida-public/AB6AXuDDHJsAt2FxmUsO5bKtlpfy0Z1qDVGgaJtnzo2LJzkKiFbkw0vuVKcalGH40n8XMhv1RhW3JMx6BX6unrMSNeTuwjQWdCQY4Pa2AC5CoxL_DDC5nWmQxHhn57CdVSFUgW8YpFQuR4R2rjCLTOGlsQUFhocM5Wkekwklf5wvUp6cVOgO4N2su-ixOPwHudzibzed0YvTupEf3GxaS5V4Mwcj0s9ZC7g1ks3T-2-SoHj6Qkp2WlXZgDogrg',
        matchScore: 99.4,
        category: 'Insecta',
        status: 'At Risk',
      },
      caption:
        'Tagging autumn migrators heading south on Asclepias speciosa nectar stations. Healthy wing scales and vigorous flight rhythm.',
      likes: 134,
      comments: 21,
      isLiked: false,
      isSaved: false,
    },
  ]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const toggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextLiked = !p.isLiked;
          return {
            ...p,
            isLiked: nextLiked,
            likes: nextLiked ? p.likes + 1 : p.likes - 1,
          };
        }
        return p;
      })
    );
  };

  const toggleSave = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextSaved = !p.isSaved;
          showToast(nextSaved ? 'Saved to your field bookmarks' : 'Removed from bookmarks');
          return { ...p, isSaved: nextSaved };
        }
        return p;
      })
    );
  };

  return (
    <div className="flex flex-col w-full pb-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-inverse-surface text-inverse-on-surface font-label-md text-label-md shadow-xl flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary-fixed">verified</span>
          <span>{toast}</span>
        </div>
      )}

      {/* Header Bar & Quick Links */}
      <section className="px-margin pt-space-sm pb-space-xs flex items-center justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md text-primary font-bold">Community</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Live discoveries from nature lovers</p>
        </div>
        <Link
          to="/invite"
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md font-semibold active:scale-95 transition-transform shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Invite</span>
        </Link>
      </section>

      {/* Active Naturalists Stories Strip */}
      <section className="py-space-sm border-b border-outline-variant/20">
        <div className="flex items-center gap-3 overflow-x-auto px-margin no-scrollbar py-1">
          {/* Add story / my camera */}
          <Link to="/scan" className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-surface-container-high text-primary">
              <span className="material-symbols-outlined text-[24px]">add_a_photo</span>
            </div>
            <span className="font-label-sm text-[11px] text-on-surface">Log Scan</span>
          </Link>

          {[
            { name: 'Leo', active: true, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ' },
            { name: 'Dr. Thorne', active: true, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ' },
            { name: 'Chloe', active: false, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcBNCRwdxnRGutog3iWlzAlwo2Jv2I-i6Du7jPoDoBLomRiuiFZ0Umxl9SIIPLFBgTDbochoQpFNAlHlzhQMFbxcdIflya5r1nrOzhzYLREmb8c6Ox0vGAGBpMhsMCdLb3g3cxqK5KmFMuEEi3ruvDXRElG0oGmvT5MHB14dzFJ6mKa18vTmcfXtVfK7sEeP7qnD94gB1wqLZxfXrlgFKmfRF171yltZ9-pt39F064NxcCuCovj8tqlQ' },
            { name: 'Elena', active: true, avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfi7ATaUUUMifGW_IBBdgTUVooFWb95RGI7l4XwiKguIterMV-rtNjviJ-2jTCxFc41waHiBzUYwRUxWDfAkusYhd54S54kY096pBhPEEYsTlKIoX4K50UlIIz5Re_XGg2N7VNyIpuKtGzkjGVIJS9fpGqhU4OcxWt93k16vvxPcIGSBJAOEwH14VJG4t9hVtCoJaB5szhu4LKrQSEwUHPDEGLUufZjSGUc2FMK07IkCkfNenCMKBuvQ' },
          ].map((u, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className={`relative p-0.5 rounded-full ${u.active ? 'ring-2 ring-primary ring-offset-2' : 'opacity-70'}`}>
                <img alt={u.name} src={u.avatar} className="w-13 h-13 rounded-full object-cover" />
                {u.active && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-secondary ring-2 ring-surface"></span>
                )}
              </div>
              <span className="font-label-sm text-[11px] text-on-surface truncate max-w-[60px]">{u.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Segmented Filter Control */}
      <section className="px-margin pt-3">
        <div className="flex bg-surface-container-low p-1 rounded-full">
          <button
            onClick={() => setActiveTab('circle')}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'circle' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            My Circle
          </button>
          <button
            onClick={() => setActiveTab('regional')}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'regional' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            Regional (PNW)
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-1.5 rounded-full font-label-md text-label-md transition-all ${
              activeTab === 'global' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'
            }`}
          >
            Global BioBlitz
          </button>
        </div>
      </section>

      {/* Feed Posts */}
      <section className="px-margin pt-space-sm flex flex-col gap-space-md">
        {posts.map((post) => (
          <article
            key={post.id}
            className="p-space-md rounded-2xl bg-surface-container-low shadow-sm flex flex-col gap-3"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  alt={post.author.name}
                  src={post.author.avatar}
                  className="w-10 h-10 rounded-full object-cover shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-headline-sm text-headline-sm text-on-surface font-semibold leading-snug truncate">
                      {post.author.name}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-secondary-container/60 text-on-secondary-container text-[10px] font-bold">
                      {post.author.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px] text-secondary">pin_drop</span>
                    <span className="font-label-sm text-label-sm truncate">
                      {post.author.location} • {post.timeAgo}
                    </span>
                  </div>
                </div>
              </div>

              <button
                aria-label="Post menu"
                onClick={() => showToast('Post options: Share, Report, or Mute user')}
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">more_vert</span>
              </button>
            </div>

            {/* Sighting Photo */}
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-surface-container">
              <img alt={post.species.commonName} src={post.species.photoUrl} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-sm text-on-surface">
                <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                <span className="font-label-sm text-label-sm font-semibold">{Math.round(post.species.matchScore)}% sure</span>
              </div>
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-surface/90 backdrop-blur-sm text-primary font-label-sm text-label-sm font-bold">
                {post.species.category}
              </span>
            </div>

            {/* Caption & Species Info */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Link
                  to={`/species/${post.species.id}`}
                  className="font-headline-sm text-headline-sm text-on-surface font-bold hover:text-primary transition-colors"
                >
                  {post.species.commonName}
                </Link>
                <span className="font-label-sm text-label-sm text-secondary font-semibold">
                  {post.species.status}
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                <span className="text-[11px] font-medium text-on-surface-variant/70 mr-1.5">Science name:</span>
                <span className="italic">{post.species.scientificName}</span>
              </p>
              <p className="font-body-md text-body-md text-on-surface mt-1 leading-relaxed">
                "{post.caption}"
              </p>
            </div>

            {/* Interaction Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`h-9 px-3 rounded-full flex items-center gap-1.5 font-label-sm text-label-sm active:scale-90 transition-transform ${
                    post.isLiked
                      ? 'bg-secondary-container text-on-secondary-container font-bold'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">eco</span>
                  <span>{post.likes}</span>
                </button>
                <button
                  onClick={() => showToast(`Opened discussion thread (${post.comments} comments)`)}
                  className="h-9 px-3 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center gap-1.5 text-on-surface font-label-sm text-label-sm active:scale-95 transition-transform"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                  <span>{post.comments}</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleSave(post.id)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-90 ${
                    post.isSaved ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {post.isSaved ? 'bookmark' : 'bookmark_border'}
                  </span>
                </button>
                <button
                  onClick={() => showToast('Observation link copied to share!')}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface active:scale-90"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">share</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
