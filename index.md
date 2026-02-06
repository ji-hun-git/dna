<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jihun Chae | KAIST Games & Life Lab</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        /* * DESIGN SYSTEM: Apple 'Human Interface' + Google 'Material You'
         * Clean typography, high whitespace, subtle borders, no harsh shadows.
         */
        :root {
            --bg-body: #ffffff;
            --bg-sidebar: #fbfbfd; /* Apple subtle gray */
            --text-primary: #1d1d1f;
            --text-secondary: #86868b;
            --accent-blue: #0071e3; /* Apple Blue */
            --border-color: #d2d2d7;
            --tag-bg: #e8f2ff;
            --tag-text: #0056b3;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
            color: var(--text-primary);
            margin: 0;
            line-height: 1.6;
            -webkit-font-smoothing: antialiased;
        }

        /* LAYOUT: Split Screen (Desktop) / Stacked (Mobile) */
        .wrapper {
            display: grid;
            grid-template-columns: 320px 1fr;
            min-height: 100vh;
        }

        /* --- LEFT SIDEBAR (Fixed Info) --- */
        .sidebar {
            background: var(--bg-sidebar);
            padding: 60px 40px;
            border-right: 1px solid rgba(0,0,0,0.06);
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 30px;
        }

        .profile-img {
            width: 160px;
            height: 160px;
            border-radius: 38px; /* Smooth Squircle */
            object-fit: cover;
            margin-bottom: 10px;
            box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        }

        .name-block h1 {
            font-size: 2rem;
            font-weight: 700;
            letter-spacing: -0.02em;
            margin: 0 0 5px 0;
        }

        .name-block p {
            color: var(--text-secondary);
            font-size: 1rem;
            margin: 0;
            line-height: 1.4;
        }

        .contact-links {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .contact-btn {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: var(--text-primary);
            font-size: 0.9rem;
            font-weight: 500;
            padding: 8px 12px;
            background: #ffffff;
            border: 1px solid rgba(0,0,0,0.05);
            border-radius: 12px;
            transition: all 0.2s ease;
        }

        .contact-btn:hover {
            border-color: var(--accent-blue);
            color: var(--accent-blue);
            transform: translateX(2px);
        }

        .edu-block {
            margin-top: 20px;
            font-size: 0.85rem;
        }
        .edu-item {
            margin-bottom: 15px;
            border-left: 2px solid #e5e5e5;
            padding-left: 12px;
        }
        .edu-school { font-weight: 600; color: #000; display: block; }
        .edu-degree { color: var(--text-secondary); display: block; }
        .edu-year { color: var(--accent-blue); font-size: 0.75rem; font-weight: 600; }

        /* --- RIGHT CONTENT (Scrollable Work) --- */
        .content {
            padding: 80px 60px;
            max-width: 900px;
        }

        section { margin-bottom: 80px; }

        .section-title {
            font-size: 1.5rem;
            font-weight: 700;
            margin-bottom: 30px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
            color: var(--text-primary);
        }

        /* --- PUBS & PROJECTS Styling --- */
        .year-marker {
            font-size: 0.85rem;
            font-weight: 700;
            color: var(--text-secondary);
            margin: 40px 0 20px 0;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .pub-entry {
            margin-bottom: 24px;
            font-size: 1rem;
        }

        .pub-title {
            font-weight: 600;
            color: #000;
            display: block;
            margin-bottom: 4px;
        }

        .pub-meta {
            color: var(--text-secondary);
            font-size: 0.95rem;
        }
        
        /* Highlight specific text like your name */
        .me { font-weight: 700; color: var(--text-primary); border-bottom: 2px solid var(--accent-blue); }

        .badge {
            display: inline-block;
            background: var(--tag-bg);
            color: var(--tag-text);
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 0.7rem;
            font-weight: 700;
            vertical-align: middle;
            margin-left: 8px;
        }

        /* Project Cards */
        .project-card {
            background: #fff;
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 20px;
            padding: 30px;
            margin-bottom: 24px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .project-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            border-color: rgba(0,0,0,0.15);
        }
        .project-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 12px;
        }
        .project-role {
            font-size: 0.85rem;
            font-weight: 600;
            color: var(--accent-blue);
            text-transform: uppercase;
        }

        /* Awards List */
        .award-item {
            display: flex;
            gap: 15px;
            margin-bottom: 15px;
            align-items: flex-start;
        }
        .award-icon { color: #f5a623; margin-top: 4px; }

        /* Responsive */
        @media (max-width: 900px) {
            .wrapper { grid-template-columns: 1fr; }
            .sidebar { 
                height: auto; 
                position: relative; 
                padding: 40px 24px;
                border-right: none;
                border-bottom: 1px solid #eee;
            }
            .content { padding: 40px 24px; }
        }
    </style>
</head>
<body>

<div class="wrapper">
    
    <aside class="sidebar">
        <img src="assets/img/prof_pic.jpg" class="profile-img" alt="Jihun Chae">
        
        <div class="name-block">
            <h1>Jihun Chae</h1>
            <p>PhD Student<br>KAIST Games & Life Lab</p>
        </div>

        <div class="contact-links">
            <a href="mailto:chaejihun@kaist.ac.kr" class="contact-btn">
                <i class="fa-regular fa-envelope"></i> Email Me
            </a>
            <a href="https://scholar.google.com/citations?user=OjxItRUAAAAJ" class="contact-btn" target="_blank">
                <i class="fa-solid fa-graduation-cap"></i> Google Scholar
            </a>
            <a href="https://github.com/ji-hun-git" class="contact-btn" target="_blank">
                <i class="fa-brands fa-github"></i> GitHub
            </a>
            <a href="https://www.linkedin.com/in/chae-jihun/" class="contact-btn" target="_blank">
                <i class="fa-brands fa-linkedin"></i> LinkedIn
            </a>
        </div>

        <div style="margin-top: 10px;">
            <p style="font-weight: 600; font-size: 0.85rem; color: #86868b; margin-bottom: 10px;">EDUCATION</p>
            
            <div class="edu-item">
                <span class="edu-school">KAIST</span>
                <span class="edu-degree">PhD, Culture Technology</span>
                <span class="edu-year">2026 – Present</span>
            </div>
            
            <div class="edu-item">
                <span class="edu-school">KAIST</span>
                <span class="edu-degree">MS, Culture Technology</span>
                <span class="edu-year">2024 – 2026</span>
            </div>

            <div class="edu-item">
                <span class="edu-school">Handong Global Univ.</span>
                <span class="edu-degree">BA, ICT Convergence</span>
                <span class="edu-year">2018 – 2024</span>
            </div>
        </div>
    </aside>

    <main class="content">
        
        <section>
            <h2 class="section-title">About</h2>
            <p style="font-size: 1.1rem; max-width: 700px; color: #424245;">
                I research <strong>Human-Computer Interaction (HCI)</strong> and <strong>Generative AI</strong> in video games. 
                My focus is on creating intelligent systems that enhance accessibility for players with disabilities. 
                Currently, I am designing <strong>GAIA</strong>, an LLM-based assistant that bridges the digital divide in complex gaming environments.
            </p>
            <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <span style="background:#f5f5f7; padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500;">Game Accessibility</span>
                <span style="background:#f5f5f7; padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500;">Generative AI</span>
                <span style="background:#f5f5f7; padding: 5px 12px; border-radius: 15px; font-size: 0.85rem; font-weight: 500;">HCI</span>
            </div>
        </section>

        <section>
            <h2 class="section-title">Publications</h2>

            <div class="year-marker">2026</div>
            
            <div class="pub-entry">
                <span class="pub-title">
                    Design principles of Game AI Assistant (GAIA) for players with disabilities: Accessibility needs and ethical concerns
                    <span class="badge">1st Author</span>
                </span>
                <div class="pub-meta">
                    <span class="me">Chae, J.</span>, Seo, G., Jeong, S., & Doh, Y. Y.<br>
                    <em>ACM International Conference on Intelligent User Interfaces (IUI ’26)</em> | <a href="https://doi.org/10.1145/3742413.3789155">DOI</a>
                </div>
            </div>

            <div class="year-marker">2025</div>

            <div class="pub-entry">
                <span class="pub-title">
                    Press start to continue: A thematic analysis of hardcore players with disabilities adapting to gameplay difficulties
                    <span class="badge">Co-1st Author</span>
                </span>
                <div class="pub-meta">
                    Park, E.*, <span class="me">Chae, J.*</span>, Eum, K., Choi, E., Oh, H., & Doh, Y. Y.<br>
                    <em>ACM CHI Conference on Human Factors in Computing Systems (CHI EA ’25)</em> | <a href="https://doi.org/10.1145/3706599.3719723">DOI</a>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">The identity and role of game NPCs: Past, present, and future</span>
                <div class="pub-meta">
                    <span class="me">Chae, J.</span> & Doh, Y. Y.<br>
                    <em>DiGRA Korea 2025</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">RAG-Enhanced LLM Chatbot for Game Accessibility: Development and Evaluation of GAIA</span>
                <div class="pub-meta">
                    Oh, H., Eum, K., Park, E., <span class="me">Chae, J.</span>, Seo, J., Choi, E., & Doh, Y. Y.<br>
                    <em>Korea HCI Conference 2025</em>
                </div>
            </div>

            <div class="year-marker">2024</div>

            <div class="pub-entry">
                <span class="pub-title">Prompting-Based LLM Framework for Ethical Decision-Making (PLETH)</span>
                <div class="pub-meta">
                    Choi, E.*, <span class="me">Chae, J.*</span>, & Doh, Y. Y.<br>
                    <em>Korean Artificial Intelligence Association Conference 2024</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">GAIA: A game AI assistant service framework integrating problem-solving and emotion regulation strategies</span>
                <div class="pub-meta">
                    Eum, K.*, Park, E.*, <span class="me">Chae, J.*</span>, & Doh, Y. Y.<br>
                    <em>Korea Computer Graphics Society Conference 2024</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Challenges and opportunities of game NPC research using LLM: A scoping review</span>
                <div class="pub-meta">
                    Park, E., <span class="me">Chae, J.</span>, Kim, K., Yi, H. W., Lootah, M. K., & Doh, Y. Y.<br>
                    <em>Korean Game Society Conference 2024</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">A technical literature review of distributed management structure: Focusing on the multi-label system of HYBE Co., Ltd.</span>
                <div class="pub-meta">
                    Kim, Y. B. & <span class="me">Chae, J.</span><br>
                    <em>Korea Technology Innovation Society Conference 2024</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">From BigHit to HYBE: Sentiment analysis and strategic transition through news data</span>
                <div class="pub-meta">
                    Kim, Y. B. & <span class="me">Chae, J.</span><br>
                    <em>Korea Society for Innovation Management & Economics Conference 2024</em>
                </div>
            </div>

            <div class="year-marker">2023</div>

            <div class="pub-entry">
                <span class="pub-title">Analysis of the effects of positive and negative VR game contents on enhancing environmental awareness</span>
                <div class="pub-meta">
                    <span class="me">Chae, J.</span>, Yoo, S., Lee, Y., Kim, Y., Kim, H., & Han, D.<br>
                    <em>Journal of the Korea Computer Graphics Society</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">A study on the effect of group commitment on improving awareness of recycling through gamification</span>
                <div class="pub-meta">
                    <span class="me">Chae, J.</span>, Kim, H., Kim, Y., Kim, M., Kim, S., & Han, D.<br>
                    <em>Korea HCI Conference 2023</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Enhancing participation in rehabilitation for diplopia through gamification</span>
                <div class="pub-meta">
                    Kim, Y., <span class="me">Chae, J.</span>, Lee, Y., Kim, H., Lee, Y., & Han, D.<br>
                    <em>Korea Computer Graphics Society Conference 2023</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Eye-tracking-based VR interactive games for eye movements</span>
                <div class="pub-meta">
                    Lee, Y. S., Kim, Y., Kim, H., <span class="me">Chae, J.</span>, Lee, Y., & Han, D.<br>
                    <em>Korea Multimedia Society Conference 2023</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Methodology for improving the performance of demand forecasting through machine learning</span>
                <div class="pub-meta">
                    Yoon, D., Park, S., Song, Y., <span class="me">Chae, J.</span>, & Chung, D.<br>
                    <em>Research Square (Preprint)</em>
                </div>
            </div>

            <div class="year-marker">2022</div>

            <div class="pub-entry">
                <span class="pub-title">Explored systematic exposure methods influenced by spatiotemporal factors in VR treatment for cynophobia</span>
                <div class="pub-meta">
                    Yoo, S., <span class="me">Chae, J.</span>, Kim, H., Lee, Y., Kim, S., Kim, Y., & Han, S.<br>
                    <em>Korea Multimedia Society Conference 2022</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Enhanced predictive model performance through clustering</span>
                <div class="pub-meta">
                    Park, S., Yoon, D., <span class="me">Chae, J.</span>, Song, Y., & Chung, D.<br>
                    <em>Korea Society of Management Information Systems Conference 2022</em>
                </div>
            </div>

            <div class="pub-entry">
                <span class="pub-title">Combined regression coefficient reduction method with clustering for performance enhancement</span>
                <div class="pub-meta">
                    Park, S., Yoon, D., Song, Y., <span class="me">Chae, J.</span>, & Chung, D.<br>
                    <em>Korea Intelligent Information Systems Society Conference 2022</em>
                </div>
            </div>
        </section>

        <section>
            <h2 class="section-title">Research Projects</h2>

            <div class="project-card">
                <div class="project-header">
                    <h3>Inclusive Conversational AI Service (GAIA)</h3>
                    <span class="project-role">Student Lead</span>
                </div>
                <p><strong>May 2024 – Apr 2027 | KAIST (NRF Funded)</strong></p>
                <p style="color: #666; font-size: 0.95rem;">
                    Leading user research and technical development of a conversational AI agent designed to bridge the digital divide for gamers with disabilities. Conducting participatory design workshops to integrate lived experiences into the AI training loop.
                </p>
                <p style="font-size: 0.85rem; color: #86868b; margin-top: 10px;">
                    <i class="fa-solid fa-users"></i> Partners: Samsung Electronics, Nexon, Smilegate, SpecialEffect (UK).
                </p>
            </div>

            <div class="project-card">
                <div class="project-header">
                    <h3>Preserving the Haenyeo Legacy</h3>
                    <span class="project-role">Researcher</span>
                </div>
                <p><strong>Jun 2025 – Sep 2025 | KAIST & Leverhulme Trust</strong></p>
                <p style="color: #666; font-size: 0.95rem;">
                    Co-designing serious games to archive the UNESCO Intangible Cultural Heritage of Jeju Haenyeo. Focusing on intergenerational knowledge transfer and environmental stewardship.
                </p>
            </div>

            <div class="project-card">
                <div class="project-header">
                    <h3>Real-Time XR Interface Technology</h3>
                    <span class="project-role">Researcher</span>
                </div>
                <p><strong>Apr 2024 – Jun 2025 | KAIST (IITP)</strong></p>
                <p style="color: #666; font-size: 0.95rem;">
                    Engineering a scalable XR platform managing "Meta-Objects" that adapt to physical constraints in real-time. Developing immersive visual-haptic interfaces with Fraunhofer Institute.
                </p>
            </div>

            <div class="project-card">
                <div class="project-header">
                    <h3>Defense Tech: Camouflage Effectiveness</h3>
                    <span class="project-role">Researcher</span>
                </div>
                <p><strong>Apr 2023 – Feb 2024 | KAI (Korea Aerospace Industries)</strong></p>
                <p style="color: #666; font-size: 0.95rem;">
                    Executed quantitative analysis on the visual stealth capabilities of the KF-21 Boramae fighter jet. Suggested new camouflage patterns based on climatic simulation data.
                </p>
            </div>

            <div class="project-card">
                <div class="project-header">
                    <h3>Smart City Infrastructure & AI Object Tracking</h3>
                    <span class="project-role">Researcher</span>
                </div>
                <p><strong>Jan 2023 – Feb 2024 | Handong Global Univ.</strong></p>
                <p style="color: #666; font-size: 0.95rem;">
                    Architected IoT data collection units and deployed AI computer vision algorithms (dynamic anchor box clustering) for optimizing object tracking in urban roads.
                </p>
            </div>
        </section>

        <section>
            <h2 class="section-title">Honors & Awards</h2>
            
            <div class="award-item">
                <i class="fa-solid fa-scroll award-icon"></i>
                <div>
                    <strong>Patent: AI-Based Technology Acceptance Prediction Method</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">Korean Intellectual Property Office (No. 40-2022-0179493) | Dec 2022</span>
                </div>
            </div>

            <div class="award-item">
                <i class="fa-solid fa-trophy award-icon"></i>
                <div>
                    <strong>Selected Entrepreneurial Team (Climate Tech)</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">Asan Nanum Foundation | Mar 2024</span>
                </div>
            </div>

            <div class="award-item">
                <i class="fa-solid fa-crown award-icon"></i>
                <div>
                    <strong>Grand Prize (President's Award)</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">Pohang Culture & Arts Factory Hackathon | Jan 2024</span>
                </div>
            </div>

            <div class="award-item">
                <i class="fa-solid fa-medal award-icon"></i>
                <div>
                    <strong>Excellence Award</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">National Metaverse Developer Contest (MSIT) | Jun 2023</span>
                </div>
            </div>

            <div class="award-item">
                <i class="fa-solid fa-star award-icon"></i>
                <div>
                    <strong>Outstanding Student Research Award</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">Korea Multimedia Society (KMMS) | Nov 2023 & May 2022</span>
                </div>
            </div>

            <div class="award-item">
                <i class="fa-solid fa-certificate award-icon"></i>
                <div>
                    <strong>Certifications</strong><br>
                    <span style="color: #666; font-size: 0.9rem;">TOEIC 920 | Microsoft Azure AI-900</span>
                </div>
            </div>
        </section>

        <footer style="margin-top: 100px; color: #ccc; font-size: 0.8rem;">
            © 2026 Jihun Chae.
        </footer>

    </main>
</div>

</body>
</html>
