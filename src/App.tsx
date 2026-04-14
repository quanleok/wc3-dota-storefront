import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import './App.css'
import {
  CATEGORY_LIST,
  DEFAULT_CREDENTIALS,
  DEFAULT_CUSTOM_ENV,
  PROVIDER_FIELDS,
  SAMPLE_APPS,
  type AppDownload,
  type AppRequirement,
  type AppSourceType,
  type AppVisibility,
  type Category,
  type CustomEnvVariable,
  type PrototypeState,
  type ProviderId,
  type ShareApp,
} from './appData'

type Screen = 'explore' | 'detail' | 'upload' | 'myApps' | 'settings'
type SortMode = 'popular' | 'new'
type BrowseView = 'grid' | 'list'
type FilterCategory = Category | 'All'

interface UploadFormState {
  sourceType: AppSourceType
  sourceValue: string
  name: string
  thumbnail: string
  shortDescription: string
  category: Category
  visibility: AppVisibility
  providerRequirements: ProviderId[]
  envRequirements: string
}

const STORAGE_KEY = 'allshareapp-prototype-v3'

const DEFAULT_UPLOAD_FORM: UploadFormState = {
  sourceType: 'package',
  sourceValue: '',
  name: '',
  thumbnail: '',
  shortDescription: '',
  category: 'Utility',
  visibility: 'public',
  providerRequirements: ['openai'],
  envRequirements: '',
}

function loadPrototypeState(): PrototypeState {
  if (typeof window === 'undefined') {
    return {
      apps: SAMPLE_APPS,
      favorites: [],
      credentials: DEFAULT_CREDENTIALS,
      customEnv: DEFAULT_CUSTOM_ENV,
    }
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (!saved) {
      return {
        apps: SAMPLE_APPS,
        favorites: [],
        credentials: DEFAULT_CREDENTIALS,
        customEnv: DEFAULT_CUSTOM_ENV,
      }
    }

    const parsed = JSON.parse(saved) as PrototypeState
    return {
      apps: parsed.apps?.length ? parsed.apps.map(hydrateStoredApp) : SAMPLE_APPS,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      credentials: { ...DEFAULT_CREDENTIALS, ...parsed.credentials },
      customEnv: Array.isArray(parsed.customEnv) ? parsed.customEnv : DEFAULT_CUSTOM_ENV,
    }
  } catch {
    return {
      apps: SAMPLE_APPS,
      favorites: [],
      credentials: DEFAULT_CREDENTIALS,
      customEnv: DEFAULT_CUSTOM_ENV,
    }
  }
}

function hydrateStoredApp(app: ShareApp): ShareApp {
  const bundledApp = SAMPLE_APPS.find((sampleApp) => sampleApp.id === app.id)

  if (bundledApp) {
    return bundledApp
  }

  return {
    ...app,
    downloads:
      Array.isArray(app.downloads) && app.downloads.length > 0
        ? app.downloads
        : inferDownloadsFromSource(app.sourceType, app.sourceValue),
  }
}

function App() {
  const [state, setState] = useState<PrototypeState>(loadPrototypeState)
  const [screen, setScreen] = useState<Screen>('explore')
  const [selectedAppId, setSelectedAppId] = useState('frame-grab')
  const [sortMode, setSortMode] = useState<SortMode>('popular')
  const [browseView, setBrowseView] = useState<BrowseView>('grid')
  const [showCategories, setShowCategories] = useState(false)
  const [activeCategory, setActiveCategory] = useState<FilterCategory>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadForm, setUploadForm] = useState<UploadFormState>(DEFAULT_UPLOAD_FORM)
  const [uploadFeedback, setUploadFeedback] = useState('')
  const [actionFeedback, setActionFeedback] = useState('')
  const [actionLoading, setActionLoading] = useState<'download' | null>(null)
  const [envDraft, setEnvDraft] = useState<CustomEnvVariable>({
    name: '',
    value: '',
    note: '',
  })

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const publicApps = useMemo(
    () => state.apps.filter((app) => app.visibility === 'public'),
    [state.apps],
  )

  const selectedApp =
    state.apps.find((app) => app.id === selectedAppId) ?? publicApps[0] ?? state.apps[0]

  const filteredApps = useMemo(() => {
    const filtered = publicApps.filter((app) => {
      if (activeCategory !== 'All' && app.category !== activeCategory) {
        return false
      }

      if (!deferredSearch) {
        return true
      }

      const haystack = [app.name, app.creator, app.category, app.shortDescription]
        .join(' ')
        .toLowerCase()

      return haystack.includes(deferredSearch)
    })

    return sortMode === 'popular'
      ? [...filtered].sort((left, right) => right.popularity - left.popularity)
      : [...filtered].sort((left, right) => sortByDate(left.publishedAt, right.publishedAt))
  }, [activeCategory, deferredSearch, publicApps, sortMode])

  const myUploads = useMemo(() => state.apps.filter((app) => app.owner), [state.apps])
  const savedApps = useMemo(
    () =>
      state.apps.filter(
        (app) => app.visibility === 'public' && !app.owner && state.favorites.includes(app.id),
      ),
    [state.apps, state.favorites],
  )
  const relatedApps = useMemo(() => {
    if (!selectedApp) {
      return []
    }

    return publicApps
      .filter((app) => app.id !== selectedApp.id && app.category === selectedApp.category)
      .slice(0, 3)
  }, [publicApps, selectedApp])

  const downloadableAppCount = useMemo(
    () => publicApps.filter((app) => app.downloads.length > 0).length,
    [publicApps],
  )

  const selectedAppSaved = selectedApp ? state.favorites.includes(selectedApp.id) : false
  const primaryDownload = selectedApp ? getPrimaryDownload(selectedApp) : undefined

  function openScreen(nextScreen: Screen) {
    startTransition(() => {
      setScreen(nextScreen)
    })
  }

  function openExplore(nextSort?: SortMode) {
    if (nextSort) {
      setSortMode(nextSort)
    }
    openScreen('explore')
  }

  function openApp(appId: string) {
    setSelectedAppId(appId)
    setActionFeedback('')
    openScreen('detail')
  }

  function openProfile(nextScreen: 'myApps' | 'settings') {
    openScreen(nextScreen)
  }

  function toggleCategoryRail() {
    if (screen !== 'explore') {
      openScreen('explore')
      setShowCategories(true)
      return
    }

    setShowCategories((current) => !current)
  }

  function handleSearch(value: string) {
    setSearchQuery(value)
    if (screen !== 'explore') {
      openScreen('explore')
    }
  }

  function handleFavoriteToggle(appId: string) {
    setState((current) => {
      const exists = current.favorites.includes(appId)
      return {
        ...current,
        favorites: exists
          ? current.favorites.filter((favorite) => favorite !== appId)
          : [...current.favorites, appId],
      }
    })
  }

  function startDownload(download: AppDownload, appName: string) {
    setActionLoading('download')
    setActionFeedback(`Downloading ${appName} for ${download.platform}...`)

    if (/^https?:\/\//i.test(download.url)) {
      window.open(download.url, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => setActionLoading(null), 400)
      return
    }

    const link = document.createElement('a')
    link.href = download.url
    link.download = ''
    link.rel = 'noreferrer'
    document.body.append(link)
    link.click()
    link.remove()

    window.setTimeout(() => setActionLoading(null), 400)
  }

  function handlePrimaryDownload() {
    if (!selectedApp) {
      return
    }

    if (!primaryDownload) {
      setActionFeedback('No downloadable build published yet.')
      return
    }

    startDownload(primaryDownload, selectedApp.name)
  }

  function updateCredential(id: ProviderId, value: string) {
    setState((current) => ({
      ...current,
      credentials: {
        ...current.credentials,
        [id]: value,
      },
    }))
  }

  function addCustomEnv() {
    const name = envDraft.name.trim().toUpperCase()
    if (!name) {
      return
    }

    const nextEntry = {
      name,
      value: envDraft.value.trim(),
      note: envDraft.note.trim(),
    }

    setState((current) => {
      const existingIndex = current.customEnv.findIndex((item) => item.name === name)

      if (existingIndex >= 0) {
        return {
          ...current,
          customEnv: current.customEnv.map((item, index) =>
            index === existingIndex ? nextEntry : item,
          ),
        }
      }

      return {
        ...current,
        customEnv: [...current.customEnv, nextEntry],
      }
    })

    setEnvDraft({ name: '', value: '', note: '' })
  }

  function removeCustomEnv(name: string) {
    setState((current) => ({
      ...current,
      customEnv: current.customEnv.filter((item) => item.name !== name),
    }))
  }

  function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !uploadForm.name.trim() ||
      !uploadForm.shortDescription.trim() ||
      !uploadForm.sourceValue.trim()
    ) {
      setUploadFeedback('Add a download source, app name, and short description first.')
      return
    }

    const envRequirements = uploadForm.envRequirements
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)

    const providerRequirements = uploadForm.providerRequirements.map((providerId) => {
      const field = PROVIDER_FIELDS.find((item) => item.id === providerId)!
      return {
        kind: 'provider' as const,
        key: providerId,
        label: field.label,
        helper: field.helper,
      }
    })

    const extraEnvRequirements = envRequirements.map((name) => ({
      kind: 'env' as const,
      key: name,
      label: `${name} env var`,
      helper: 'Declared by the app and filled by the user after local install.',
    }))

    const newApp: ShareApp = {
      id: createAppId(uploadForm.name),
      name: uploadForm.name.trim(),
      monogram: resolveMonogram(uploadForm.thumbnail, uploadForm.name),
      shortDescription: uploadForm.shortDescription.trim(),
      description: `${uploadForm.shortDescription.trim()} This listing is intentionally compact on the directory page, with install details and setup notes pushed into the standalone detail view.`,
      category: uploadForm.category,
      visibility: uploadForm.visibility,
      creator: 'You',
      popularity: uploadForm.visibility === 'public' ? 54 : 22,
      publishedAt: new Date().toISOString().slice(0, 10),
      accent: '#7bf7c7',
      tint: 'rgba(123, 247, 199, 0.14)',
      requirements: [...providerRequirements, ...extraEnvRequirements],
      previews: [
        {
          eyebrow: 'Entry',
          title: 'Directory listing ready',
          note: uploadForm.sourceValue.trim(),
        },
        {
          eyebrow: 'Install',
          title: 'Download and use locally',
          note: 'ShareApp lists the build or package. The app itself runs outside the site.',
        },
        {
          eyebrow: 'Keys',
          title: 'Requirements stay explicit',
          note: 'If the app needs secrets, the listing can still declare them clearly before install.',
        },
      ],
      downloads: buildUploadDownloads(uploadForm),
      sourceType: uploadForm.sourceType,
      sourceValue: uploadForm.sourceValue.trim(),
      owner: true,
      status: uploadForm.visibility === 'public' ? 'Published' : 'Private',
      metaLabel: getSourceMetaLabel(uploadForm.sourceType),
    }

    setState((current) => ({
      ...current,
      apps: [newApp, ...current.apps],
    }))

    setUploadFeedback(
      `${newApp.name} published as ${newApp.visibility} with ${newApp.requirements.length} declared requirement${newApp.requirements.length === 1 ? '' : 's'}.`,
    )
    setUploadForm(DEFAULT_UPLOAD_FORM)
    setSelectedAppId(newApp.id)
    openScreen('detail')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand-button" onClick={() => openExplore()}>
          ShareApp
        </button>

        <label className="header-search" aria-label="Search apps">
          <span>/</span>
          <input
            value={searchQuery}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="search apps"
          />
        </label>

        <nav className="header-nav" aria-label="Primary">
          <button
            className={screen === 'explore' && sortMode === 'popular' ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setShowCategories(false)
              openExplore('popular')
            }}
          >
            Popular
          </button>
          <button
            className={screen === 'explore' && sortMode === 'new' ? 'nav-item active' : 'nav-item'}
            onClick={() => {
              setShowCategories(false)
              openExplore('new')
            }}
          >
            New
          </button>
          <button
            className={showCategories ? 'nav-item active' : 'nav-item'}
            onClick={toggleCategoryRail}
          >
            Categories
          </button>
          <button
            className={screen === 'upload' ? 'nav-item active' : 'nav-item'}
            onClick={() => openScreen('upload')}
          >
            Upload
          </button>
          <button
            className={screen === 'myApps' || screen === 'settings' ? 'profile-chip active' : 'profile-chip'}
            onClick={() => openProfile('myApps')}
          >
            Profile
          </button>
        </nav>
      </header>

      <main className="app-main">
        {screen === 'explore' && (
          <section className="screen">
            <div className="screen-bar">
              <div>
                <p className="section-label">
                  {sortMode === 'popular' ? 'Popular apps' : 'New apps'}
                </p>
                <p className="section-caption">
                  {filteredApps.length} listed / {downloadableAppCount} downloadable now
                </p>
              </div>

              <div className="view-toggle" role="tablist" aria-label="Browse view">
                <button
                  className={browseView === 'grid' ? 'toggle-button active' : 'toggle-button'}
                  onClick={() => setBrowseView('grid')}
                >
                  Grid
                </button>
                <button
                  className={browseView === 'list' ? 'toggle-button active' : 'toggle-button'}
                  onClick={() => setBrowseView('list')}
                >
                  List
                </button>
              </div>
            </div>

            {showCategories && (
              <div className="category-strip">
                <button
                  className={activeCategory === 'All' ? 'category-chip active' : 'category-chip'}
                  onClick={() => setActiveCategory('All')}
                >
                  All
                </button>
                {CATEGORY_LIST.map((category) => (
                  <button
                    key={category}
                    className={activeCategory === category ? 'category-chip active' : 'category-chip'}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {filteredApps.length > 0 ? (
              browseView === 'grid' ? (
                <div className="directory-grid">
                  {filteredApps.map((app) => (
                    <GridTile key={app.id} app={app} onOpen={openApp} />
                  ))}
                </div>
              ) : (
                <div className="directory-list">
                  {filteredApps.map((app) => (
                    <ListRow key={app.id} app={app} onOpen={openApp} />
                  ))}
                </div>
              )
            ) : (
              <div className="empty-line">No apps match that search or category.</div>
            )}
          </section>
        )}

        {screen === 'detail' && selectedApp && (
          <section className="screen detail-screen">
            <div className="detail-top">
              <button className="mini-link" onClick={() => openExplore()}>
                Back
              </button>
              <span className="mono-inline">
                {formatSourceType(selectedApp.sourceType)} / {formatDate(selectedApp.publishedAt)}
              </span>
            </div>

            <div className="detail-hero">
              <div className="detail-heading">
                <AppIcon app={selectedApp} size="large" />

                <div className="detail-copy">
                  <div className="detail-meta-line">
                    <span>{selectedApp.category}</span>
                    {selectedApp.owner && <span>{capitalize(selectedApp.visibility)}</span>}
                  </div>
                  <h1>{selectedApp.name}</h1>
                  <p className="mono-inline">by {selectedApp.creator} / {selectedApp.metaLabel}</p>
                  <p className="detail-body">{selectedApp.description}</p>
                </div>
              </div>

              <div className="detail-actions">
                {primaryDownload ? (
                  <button
                    className="primary-button"
                    onClick={handlePrimaryDownload}
                    disabled={actionLoading !== null}
                  >
                    {actionLoading === 'download' ? 'Preparing...' : primaryDownload.label}
                  </button>
                ) : (
                  <button className="primary-button" disabled>
                    No download yet
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => handleFavoriteToggle(selectedApp.id)}
                >
                  {selectedAppSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>

            {actionFeedback && <div className="terminal-note">{actionFeedback}</div>}

            <div className="detail-layout">
              <section className="detail-section">
                <header className="section-rule">
                  <span>Downloads</span>
                  <span>{selectedApp.downloads.length}</span>
                </header>
                {selectedApp.downloads.length > 0 ? (
                  <>
                    <ul className="download-list">
                      {selectedApp.downloads.map((download) => {
                        return (
                          <li key={`${selectedApp.id}-${download.platform}-${download.url}`}>
                            <div className="download-copy">
                              <strong>{download.label}</strong>
                              <p>{download.note}</p>
                            </div>
                            <div className="download-end">
                              <span className="status-pill ok">{download.platform}</span>
                              <button
                                className="secondary-button"
                                onClick={() => startDownload(download, selectedApp.name)}
                                disabled={actionLoading !== null}
                              >
                                {actionLoading === 'download' ? 'Preparing...' : 'Download'}
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                    <p className="section-caption">
                      These apps install locally. ShareApp does not execute them in the browser.
                    </p>
                  </>
                ) : (
                  <div className="empty-line">No downloadable build published yet.</div>
                )}
              </section>

              <section className="detail-section">
                <header className="section-rule">
                  <span>Preview</span>
                  <span>{selectedApp.previews.length}</span>
                </header>
                <div className="preview-stack">
                  {selectedApp.previews.map((preview) => (
                    <article key={`${selectedApp.id}-${preview.title}`} className="preview-row">
                      <p className="preview-label">{preview.eyebrow}</p>
                      <h3>{preview.title}</h3>
                      <p>{preview.note}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <section className="detail-section">
              <header className="section-rule">
                <span>Required keys</span>
                <span>{selectedApp.requirements.length}</span>
              </header>
              {selectedApp.requirements.length > 0 ? (
                <>
                  <ul className="requirement-list">
                    {selectedApp.requirements.map((requirement) => {
                      const connection = getRequirementConnection(requirement, state)
                      return (
                        <li key={`${selectedApp.id}-${requirement.key}`}>
                          <div>
                            <strong>{requirement.label}</strong>
                            <p>{requirement.helper}</p>
                          </div>
                          <span className={connection.connected ? 'status-pill ok' : 'status-pill'}>
                            {connection.connected ? 'saved' : 'missing'}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                  <p className="section-caption">
                    Apps only declare requirements. Keys remain in your Settings.
                  </p>
                </>
              ) : (
                <div className="empty-line">No API keys or env vars required for this tool.</div>
              )}
            </section>

            {relatedApps.length > 0 && (
              <section className="detail-section">
                <header className="section-rule">
                  <span>Related</span>
                  <span>{relatedApps.length}</span>
                </header>
                <div className="directory-list compact">
                  {relatedApps.map((app) => (
                    <ListRow key={app.id} app={app} onOpen={openApp} compact />
                  ))}
                </div>
              </section>
            )}
          </section>
        )}

        {screen === 'upload' && (
          <section className="screen form-screen">
            <div className="screen-head">
              <p className="section-label">Upload</p>
              <h1>Publish a downloadable build.</h1>
              <p className="section-caption">
                Minimal by design. Browse stays clean. Detail pages carry the install notes.
              </p>
            </div>

            {uploadFeedback && <div className="terminal-note">{uploadFeedback}</div>}

            <form className="minimal-form" onSubmit={handleUploadSubmit}>
              <div className="form-block">
                <label>Source type</label>
                <div className="inline-select">
                  {(['package', 'link', 'repo', 'config'] as AppSourceType[]).map((sourceType) => (
                    <button
                      key={sourceType}
                      type="button"
                      className={
                        uploadForm.sourceType === sourceType ? 'toggle-button active' : 'toggle-button'
                      }
                      onClick={() =>
                        setUploadForm((current) => ({
                          ...current,
                          sourceType,
                        }))
                      }
                    >
                      {formatSourceType(sourceType)}
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Source"
                value={uploadForm.sourceValue}
                onChange={(value) =>
                  setUploadForm((current) => ({
                    ...current,
                    sourceValue: value,
                  }))
                }
                placeholder="https://example.com/frameforge-macos.zip"
              />

              <div className="form-columns">
                <Field
                  label="App name"
                  value={uploadForm.name}
                  onChange={(value) =>
                    setUploadForm((current) => ({
                      ...current,
                      name: value,
                    }))
                  }
                  placeholder="FrameForge"
                />
                <Field
                  label="Icon initials"
                  value={uploadForm.thumbnail}
                  onChange={(value) =>
                    setUploadForm((current) => ({
                      ...current,
                      thumbnail: value,
                    }))
                  }
                  placeholder="FF"
                />
              </div>

              <Field
                label="Short description"
                value={uploadForm.shortDescription}
                onChange={(value) =>
                  setUploadForm((current) => ({
                    ...current,
                    shortDescription: value,
                  }))
                }
                placeholder="Short, one-line explanation of what the app does."
                multiline
              />

              <div className="form-columns">
                <label className="field">
                  <span>Category</span>
                  <select
                    value={uploadForm.category}
                    onChange={(event) =>
                      setUploadForm((current) => ({
                        ...current,
                        category: event.target.value as Category,
                      }))
                    }
                  >
                    {CATEGORY_LIST.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-block">
                  <label>Visibility</label>
                  <div className="inline-select">
                    {(['public', 'private'] as AppVisibility[]).map((visibility) => (
                      <button
                        key={visibility}
                        type="button"
                        className={
                          uploadForm.visibility === visibility
                            ? 'toggle-button active'
                            : 'toggle-button'
                        }
                        onClick={() =>
                          setUploadForm((current) => ({
                            ...current,
                            visibility,
                          }))
                        }
                      >
                        {capitalize(visibility)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="form-block">
                <label>Required API keys</label>
                <div className="check-grid">
                  {PROVIDER_FIELDS.map((field) => {
                    const checked = uploadForm.providerRequirements.includes(field.id)
                    return (
                      <label key={field.id} className={checked ? 'check-line active' : 'check-line'}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setUploadForm((current) => ({
                              ...current,
                              providerRequirements: checked
                                ? current.providerRequirements.filter((item) => item !== field.id)
                                : [...current.providerRequirements, field.id],
                            }))
                          }
                        />
                        <span>{field.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <Field
                label="Other env vars"
                value={uploadForm.envRequirements}
                onChange={(value) =>
                  setUploadForm((current) => ({
                    ...current,
                    envRequirements: value,
                  }))
                }
                placeholder="SERPAPI_KEY, GITHUB_TOKEN"
              />

              <div className="submit-row">
                <p className="section-caption">
                  Declared later: {getRequirementSummary(uploadForm.providerRequirements, uploadForm.envRequirements)}
                </p>
                <button className="primary-button" type="submit">
                  Publish
                </button>
              </div>
            </form>
          </section>
        )}

        {screen === 'myApps' && (
          <section className="screen">
            <ProfileTabs current="myApps" onOpen={openProfile} />

            <div className="screen-head">
              <p className="section-label">Library</p>
              <h1>Your apps.</h1>
              <p className="section-caption">
                Public and private stay visible here. Explore stays clean.
              </p>
            </div>

            <section className="library-group">
              <header className="section-rule">
                <span>Uploaded</span>
                <span>{myUploads.length}</span>
              </header>
              <div className="directory-list compact">
                {myUploads.map((app) => (
                  <OwnerRow key={app.id} app={app} onOpen={openApp} />
                ))}
              </div>
            </section>

            <section className="library-group">
              <header className="section-rule">
                <span>Saved</span>
                <span>{savedApps.length}</span>
              </header>
              {savedApps.length > 0 ? (
                <div className="directory-list compact">
                  {savedApps.map((app) => (
                    <ListRow key={app.id} app={app} onOpen={openApp} compact />
                  ))}
                </div>
              ) : (
                <div className="empty-line">No saved apps yet.</div>
              )}
            </section>
          </section>
        )}

        {screen === 'settings' && (
          <section className="screen">
            <ProfileTabs current="settings" onOpen={openProfile} />

            <div className="screen-head">
              <p className="section-label">Settings</p>
              <h1>Saved keys.</h1>
              <p className="section-caption">
                Save once here. Compatible apps can reuse them later.
              </p>
            </div>

            {actionFeedback && <div className="terminal-note">{actionFeedback}</div>}

            <section className="settings-group">
              <header className="section-rule">
                <span>Providers</span>
                <span>{PROVIDER_FIELDS.length}</span>
              </header>
              <div className="settings-list">
                {PROVIDER_FIELDS.map((field) => (
                  <label key={field.id} className="settings-row">
                    <div>
                      <strong>{field.label}</strong>
                      <p>{field.helper}</p>
                    </div>
                    <input
                      type="password"
                      placeholder={field.placeholder}
                      value={state.credentials[field.id]}
                      onChange={(event) => updateCredential(field.id, event.target.value)}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="settings-group">
              <header className="section-rule">
                <span>Custom env vars</span>
                <span>{state.customEnv.filter((item) => item.name).length}</span>
              </header>

              <div className="env-compose">
                <div className="form-columns">
                  <Field
                    label="Name"
                    value={envDraft.name}
                    onChange={(value) =>
                      setEnvDraft((current) => ({
                        ...current,
                        name: value,
                      }))
                    }
                    placeholder="SERPAPI_KEY"
                  />
                  <Field
                    label="Value"
                    value={envDraft.value}
                    onChange={(value) =>
                      setEnvDraft((current) => ({
                        ...current,
                        value,
                      }))
                    }
                    placeholder="secret"
                  />
                </div>

                <Field
                  label="Note"
                  value={envDraft.note}
                  onChange={(value) =>
                    setEnvDraft((current) => ({
                      ...current,
                      note: value,
                    }))
                  }
                  placeholder="Optional note"
                />

                <button className="secondary-button" type="button" onClick={addCustomEnv}>
                  Save env var
                </button>
              </div>

              <div className="env-list">
                {state.customEnv.filter((item) => item.name).map((item) => (
                  <article key={item.name} className="env-item">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.note || 'Custom env var'}</p>
                    </div>
                    <div className="env-end">
                      <span className="mono-inline">{maskSecret(item.value)}</span>
                      <button className="mini-link" onClick={() => removeCustomEnv(item.name)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

function GridTile({
  app,
  onOpen,
}: {
  app: ShareApp
  onOpen: (appId: string) => void
}) {
  return (
    <button className="grid-tile" onClick={() => onOpen(app.id)}>
      <AppIcon app={app} />
        <div className="tile-copy">
          <h2>{app.name}</h2>
          <p className="mono-inline">by {app.creator}</p>
          <p className="mono-inline muted">{app.metaLabel}</p>
        </div>
      <div className="tile-foot">
        <span>{app.category}</span>
        <span className="tile-arrow">open</span>
      </div>
    </button>
  )
}

function ListRow({
  app,
  onOpen,
  compact = false,
}: {
  app: ShareApp
  onOpen: (appId: string) => void
  compact?: boolean
}) {
  return (
    <button className={compact ? 'list-row compact' : 'list-row'} onClick={() => onOpen(app.id)}>
      <div className="list-row-start">
        <AppIcon app={app} />
        <div>
          <strong>{app.name}</strong>
          <p className="mono-inline">by {app.creator}</p>
        </div>
      </div>
      <div className="list-row-end">
        <span>{app.category}</span>
        <span className="mono-inline">{app.metaLabel}</span>
      </div>
    </button>
  )
}

function OwnerRow({
  app,
  onOpen,
}: {
  app: ShareApp
  onOpen: (appId: string) => void
}) {
  return (
    <button className="list-row compact" onClick={() => onOpen(app.id)}>
      <div className="list-row-start">
        <AppIcon app={app} />
        <div>
          <strong>{app.name}</strong>
          <p className="mono-inline">
            {capitalize(app.visibility)} / {app.status}
          </p>
        </div>
      </div>
      <div className="list-row-end">
        <span>{app.category}</span>
        <span className="mono-inline">{formatDate(app.publishedAt)}</span>
      </div>
    </button>
  )
}

function ProfileTabs({
  current,
  onOpen,
}: {
  current: 'myApps' | 'settings'
  onOpen: (screen: 'myApps' | 'settings') => void
}) {
  return (
    <div className="profile-tabs">
      <button
        className={current === 'myApps' ? 'toggle-button active' : 'toggle-button'}
        onClick={() => onOpen('myApps')}
      >
        My Apps
      </button>
      <button
        className={current === 'settings' ? 'toggle-button active' : 'toggle-button'}
        onClick={() => onOpen('settings')}
      >
        Keys
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  multiline?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  )
}

function AppIcon({
  app,
  size = 'default',
}: {
  app: Pick<ShareApp, 'monogram' | 'name'>
  size?: 'default' | 'large'
}) {
  return (
    <div className={size === 'large' ? 'app-icon large' : 'app-icon'} aria-label={`${app.name} icon`}>
      <span>{app.monogram}</span>
    </div>
  )
}

function getRequirementConnection(requirement: AppRequirement, state: PrototypeState) {
  if (requirement.kind === 'provider') {
    const value = state.credentials[requirement.key as ProviderId]
    return { connected: Boolean(value?.trim()) }
  }

  const saved = state.customEnv.find((item) => item.name === requirement.key)
  return { connected: Boolean(saved?.value.trim()) }
}

function getPrimaryDownload(app: ShareApp) {
  return app.downloads[0]
}

function buildUploadDownloads(uploadForm: UploadFormState): AppDownload[] {
  return inferDownloadsFromSource(uploadForm.sourceType, uploadForm.sourceValue)
}

function inferDownloadsFromSource(sourceType: AppSourceType, sourceValue: string): AppDownload[] {
  const normalizedSource = sourceValue.trim()

  if (!normalizedSource) {
    return []
  }

  if (sourceType === 'desktop') {
    return [
      {
        platform: 'macOS',
        label: 'Download for macOS',
        url: normalizedSource,
        note: 'Download the macOS build, then install it locally.',
      },
    ]
  }

  if (sourceType === 'html') {
    return [
      {
        platform: 'Browser',
        label: 'Download local HTML tool',
        url: normalizedSource,
        note: 'Download the package, unzip it, and open the HTML file locally in a browser.',
      },
    ]
  }

  if (sourceType === 'package') {
    return [
      {
        platform: 'Package',
        label: 'Download package',
        url: normalizedSource,
        note: 'Download the packaged build and install it locally.',
      },
    ]
  }

  if (sourceType === 'link') {
    return [
      {
        platform: 'External',
        label: 'Open external download',
        url: normalizedSource,
        note: 'Open the external link to download or install the app outside ShareApp.',
      },
    ]
  }

  return []
}

function formatSourceType(sourceType: AppSourceType) {
  const labels: Record<AppSourceType, string> = {
    desktop: 'desktop app',
    html: 'local html tool',
    repo: 'repo',
    link: 'download link',
    package: 'package build',
    config: 'config',
  }
  return labels[sourceType]
}

function getSourceMetaLabel(sourceType: AppSourceType) {
  const labels: Record<AppSourceType, string> = {
    desktop: 'macOS app',
    html: 'Local HTML tool',
    repo: 'repo source',
    link: 'download link',
    package: 'package build',
    config: 'config',
  }
  return labels[sourceType]
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

function sortByDate(left: string, right: string) {
  return new Date(right).getTime() - new Date(left).getTime()
}

function createAppId(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resolveMonogram(thumbnail: string, name: string) {
  const clean = thumbnail.trim()

  if (clean && clean.length <= 4 && !clean.includes('://')) {
    return clean.toUpperCase()
  }

  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'AP'
  )
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

function maskSecret(value: string) {
  if (!value) {
    return 'not saved'
  }

  if (value.length <= 4) {
    return '••••'
  }

  return `${value.slice(0, 3)}••••${value.slice(-2)}`
}

function getRequirementSummary(providerIds: ProviderId[], envRequirements: string) {
  const providerLabels = providerIds.map(
    (providerId) => PROVIDER_FIELDS.find((item) => item.id === providerId)?.label ?? providerId,
  )
  const envLabels = envRequirements
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

  const parts = [...providerLabels, ...envLabels]
  return parts.length > 0 ? parts.join(', ') : 'no extra requirements'
}

export default App
