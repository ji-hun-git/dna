<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jihun Chae | Research Portfolio</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #000000;
            --surface-color: #111111;
            --surface-hover: #1c1c1e;
            --text-primary: #f5f5f7;
            --text-secondary: #86868b;
            --accent: #2997ff;
            --border: #333336;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.6;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
            overflow-x: hidden;
        }

        .wrapper {
            max-width: 1100px;
            margin: 0 auto;
            padding: 4rem 2rem;
        }

        .grid-layout {
            display: grid;
            grid-template-columns: 1fr;
            gap: 4rem;
        }

        @media (min-width: 768px) {
            .grid-layout {
                grid-template-columns: 300px 1fr;
                gap: 6rem;
            }
        }

        /* Sidebar */
        .sidebar {
            position: sticky;
            top: 4rem;
            height: max-content;
            z-index: 10;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 600;
            letter-spacing: -0.03em;
            margin: 0 0 0.5rem 0;
        }

        .title-role {
            font-size: 1.1rem;
            color: var(--text-secondary);
            font-weight: 400;
            margin-bottom: 2rem;
        }

        .contact-links {
            display: flex;
            flex-direction: column;
            gap: 0.8rem;
        }

        .contact-links a {
            color: var(--text-primary);
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.3s ease, transform 0.3s ease;
            display: inline-flex;
            align-items: center;
            width: fit-content;
        }

        .contact-links a:hover {
            color: var(--accent);
            transform: translateX(4px);
        }

        /* Content Sections */
        section {
            margin-bottom: 5rem;
        }

        h2 {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }

        /* Interactive Cards */
        .card {
            background-color: var(--surface-color);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 1.5rem;
            border: 1px solid var(--border);
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            cursor: default;
        }

        .card:hover {
            background-color: var(--surface-hover);
            transform: translateY(-4px) scale(1.01);
            border-color: #444446;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.5rem;
            flex-wrap: wrap;
            gap: 1rem;
        }

        h3 {
            font-size: 1.2rem;
            font-weight: 500;
            margin: 0;
            color: var(--text-primary);
        }

        .meta {
            font-size: 0.9rem;
            color: var(--text-secondary);
        }

        .org {
            font-weight: 500;
            color: var(--text-primary);
            margin-bottom: 1rem;
            font-size: 0.95rem;
        }

        ul {
            margin: 0;
            padding-left: 1.2rem;
            color: #a1a1a6;
            font-size: 0.95rem;
        }

        li {
            margin-bottom: 0.5rem;
        }

        /* Publications */
        .pub-list {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .pub-item {
            font-size: 0.95rem;
            color: #a1a1a6;
            line-height: 1.6;
            padding: 1.5rem;
            border-radius: 12px;
            transition: background-color 0.3s ease;
        }

        .pub-item:hover {
            background-color: var(--surface-color);
        }

        .pub-item strong {
            color: var(--text-primary);
            font-weight: 500;
        }

        .pub-link {
            color: var(--accent);
            text-decoration: none;
            font-size: 0.85rem;
            margin-top: 0.5rem;
            display: inline-flex;
            align-items: center;
            transition: gap 0.3s ease;
            gap: 4px;
        }

        .pub-link::after {
            content: '→';
            transition: transform 0.3s ease;
        }

        .pub-link:hover::after {
            transform: translateX(4px);
        }

        /* --- Scroll Reveal Animations --- */
        .reveal {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.8s cubic-bezier(0.5, 0, 0, 1), transform 0.8s cubic-bezier(0.5, 0, 0, 1);
        }

        .reveal.active {
            opacity: 1;
            transform: translateY(0);
        }

        /* Staggered load for sidebar elements */
        .delay-1 { transition-delay: 0.1s; }
        .delay-2 { transition-delay: 0.2s; }
        .delay-3 { transition-delay: 0.3s; }
    </style>
</head>
<body>

    <div class="wrapper">
        <div class="grid-layout">
            
            <aside class="sidebar">
                <h1 class="reveal active">Jihun Chae</h1>
                <div class="title-role reveal active delay-1">HCI & Generative AI Researcher</div>
                
                <div class="contact-links reveal active delay-2">
                    <a href="mailto:chaejihun@kaist.ac.kr">chaejihun@kaist.ac.kr</a>
                    <a href="https://www.linkedin.com/in/jihun-chae-15457756/" target="_blank">LinkedIn Profile</a>
                </div>
            </aside>

            <main>
                
                <section class="reveal">
                    <h2>Education</h2>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3>KAIST</h3>
                            <span class="meta">2026 – Current</span>
                        </div>
                        <div class="org">PhD Student, Graduate School of Culture Technology</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>KAIST</h3>
                            <span class="meta">2024 – 2026</span>
                        </div>
                        <div class="org">Master’s Student, Graduate School of Culture Technology</div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Handong Global University</h3>
                            <span class="meta">2018 – 2024</span>
                        </div>
                        <div class="org">ICT Convergence / Product Design</div>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Research Experience</h2>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3>Inclusive Conversational AI Service</h3>
                            <span class="meta">May 2024 – Apr 2027</span>
                        </div>
                        <div class="org">Student Researcher Lead | NRF</div>
                        <ul>
                            <li>User research and technical development of a conversational AI agent designed to bridge the digital divide for gamers with disabilities.</li>
                            <li>Establishing a cross-sector consortium to standardize accessibility guidelines with Samsung, Nexon, and Smilegate.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Preserving the Haenyeo Legacy</h3>
                            <span class="meta">Jun 2025 – Sep 2025</span>
                        </div>
                        <div class="org">Student Researcher | Leverhulme Trust</div>
                        <ul>
                            <li>Co-designing a serious game to archive and promote the UNESCO Intangible Cultural Heritage of the Jeju Haenyeo.</li>
                            <li>Designing gamified narratives highlighting environmental stewardship to drive climate action behavior.</li>
                        </ul>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Selected Publications</h2>
                    <div class="pub-list">
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, Seo, G., Jeong, S., & Doh, Y. Y. (2026). Design principles of Game AI Assistant (GAIA) for players with disabilities. <em>Proceedings of the 31st International Conference on Intelligent User Interfaces (IUI ’26)</em>.<br>
                            <a href="https://doi.org/10.1145/3742413.3789155" class="pub-link" target="_blank">View Paper</a>
                        </div>
                        <div class="pub-item">
                            Park, E., <strong>Chae, J.</strong>, Eum, K., Choi, E., Oh, H., & Doh, Y. Y. (2025). Press start to continue: A thematic analysis of the iterative process of hardcore players with disabilities. <em>CHI Conference on Human Factors in Computing Systems</em>.<br>
                            <a href="https://doi.org/10.1145/3706599.3719723" class="pub-link" target="_blank">View Paper</a>
                        </div>
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, & Doh, Y. Y. (2025). The identity and role of game NPCs: Past, present, and future. <em>Proceedings of the 1st DiGRA Korea Conference 2025</em>.
                        </div>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Honors & Awards</h2>
                    <div class="card">
                        <div class="card-header">
                            <h3>Selected Entrepreneurial Team</h3>
                            <span class="meta">Mar 2024</span>
                        </div>
                        <div class="org">Asan Nanum Foundation (Climate Tech Track)</div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <h3>Grand Prize</h3>
                            <span class="meta">Jan 2024</span>
                        </div>
                        <div class="org">Pohang Culture & Arts Factory Hackathon</div>
                    </div>
                </section>

            </main>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const observerOptions = {
                root: null,
                rootMargin: '0px',
                threshold: 0.15 // Triggers when 15% of the element is visible
            };

            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                        // Optional: Stop observing once revealed
                        // observer.unobserve(entry.target); 
                    }
                });
            }, observerOptions);

            const revealElements = document.querySelectorAll('.reveal:not(.active)');
            revealElements.forEach(el => observer.observe(el));
        });
    </script>
</body>
</html>
