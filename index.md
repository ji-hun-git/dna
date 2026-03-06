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
            white-space: nowrap;
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
            gap: 1rem;
        }

        .pub-item {
            font-size: 0.95rem;
            color: #a1a1a6;
            line-height: 1.6;
            padding: 1.2rem;
            border-radius: 12px;
            border-left: 2px solid transparent;
            transition: all 0.3s ease;
        }

        .pub-item:hover {
            background-color: var(--surface-color);
            border-left-color: var(--accent);
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

        /* Certifications List (Inline) */
        .cert-list {
            list-style: none;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .cert-list li {
            background-color: var(--surface-color);
            border: 1px solid var(--border);
            padding: 0.5rem 1rem;
            border-radius: 8px;
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        /* Scroll Reveal Animations */
        .reveal {
            opacity: 0;
            transform: translateY(30px);
            transition: opacity 0.8s cubic-bezier(0.5, 0, 0, 1), transform 0.8s cubic-bezier(0.5, 0, 0, 1);
        }

        .reveal.active {
            opacity: 1;
            transform: translateY(0);
        }

        .delay-1 { transition-delay: 0.1s; }
        .delay-2 { transition-delay: 0.2s; }
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

                    <div class="card">
                        <div class="card-header">
                            <h3>Ateneo de Manila University</h3>
                            <span class="meta">2016 – 2018</span>
                        </div>
                        <div class="org">Management of Applied Chemistry</div>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Publications</h2>
                    <div class="pub-list">
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, Seo, G., Jeong, S., & Doh, Y. Y. (2026). Design principles of Game AI Assistant (GAIA) for players with disabilities: Accessibility needs and ethical concerns. <em>Proceedings of the 31st International Conference on Intelligent User Interfaces (IUI ’26)</em>. ACM.<br>
                            <a href="https://doi.org/10.1145/3742413.3789155" class="pub-link" target="_blank">View Paper</a>
                        </div>
                        <div class="pub-item">
                            Park, E., <strong>Chae, J.</strong>, Eum, K., Choi, E., Oh, H., & Doh, Y. Y. (2025). Press start to continue: A thematic analysis of the iterative process of hardcore players with disabilities adapting to gameplay difficulties. <em>Extended Abstracts of the CHI Conference on Human Factors in Computing Systems (CHI EA ’25)</em>. ACM. (Co-first Author)<br>
                            <a href="https://doi.org/10.1145/3706599.3719723" class="pub-link" target="_blank">View Paper</a>
                        </div>
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, & Doh, Y. Y. (2025). The identity and role of game NPCs: Past, present, and future. <em>Proceedings of the 1st DiGRA Korea Conference 2025</em>.
                        </div>
                        <div class="pub-item">
                            Oh, H., Eum, K., Park, E., <strong>Chae, J.</strong>, Seo, J., Choi, E., & Doh, Y. Y. (2025). RAG-Enhanced LLM Chatbot for Game Accessibility: Development and Evaluation of GAIA. <em>Korea HCI Conference 2025</em>. (Co-second Author)
                        </div>
                        <div class="pub-item">
                            Choi, E., <strong>Chae, J.</strong>, & Doh, Y. Y. (2024). Prompting-Based LLM Framework for Ethical Decision-Making in the Trolley Dilemma: Embedding Hofstede's Cultural Dimensions Theory (PLETH). <em>Korean Artificial Intelligence Association Conference 2024</em>. (Co-first Author)
                        </div>
                        <div class="pub-item">
                            Eum, K., Park, E., <strong>Chae, J.</strong>, & Doh, Y. Y. (2024). GAIA: A game AI assistant service framework integrating problem-solving and emotion regulation strategies. <em>Korea Computer Graphics Society Conference 2024</em>. (Co-first Author)
                        </div>
                        <div class="pub-item">
                            Park, E., <strong>Chae, J.</strong>, Kim, K., Yi, H. W., Lootah, M. K., & Doh, Y. Y. (2024). Challenges and opportunities of game NPC research using LLM: A scoping review. <em>Korean Game Society Conference 2024</em>. (Co-first Author)
                        </div>
                        <div class="pub-item">
                            Kim, Y. B., & <strong>Chae, J.</strong> (2024). A technical literature review of distributed management structure: Focusing on the multi-label system of HYBE Co., Ltd. <em>Korea Technology Innovation Society Conference 2024</em>.
                        </div>
                        <div class="pub-item">
                            Kim, Y. B., & <strong>Chae, J.</strong> (2024). From BigHit to HYBE: Sentiment analysis and strategic transition through news data. <em>Korea Society for Innovation Management & Economics Conference 2024</em>.
                        </div>
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, Yoo, S., Lee, Y., Kim, Y., Kim, H., & Han, D. (2023). Analysis of the effects of positive and negative VR game contents on enhancing environmental awareness based on self-reliant and team-based play styles. <em>Journal of the Korea Computer Graphics Society</em>, 29(3), 137–147.
                        </div>
                        <div class="pub-item">
                            <strong>Chae, J.</strong>, Kim, H., Kim, Y., Kim, M., Kim, S., & Han, D. (2023). A study on the effect of group commitment on improving awareness of recycling through gamification. <em>Korea HCI Conference 2023</em>.
                        </div>
                        <div class="pub-item">
                            Kim, Y., <strong>Chae, J.</strong>, Lee, Y., Kim, H., Lee, Y., & Han, D. (2023). Enhancing participation in rehabilitation for diplopia through gamification. <em>Korea Computer Graphics Society Conference 2023</em>.
                        </div>
                        <div class="pub-item">
                            Lee, Y. S., Kim, Y., Kim, H., <strong>Chae, J.</strong>, Lee, Y., & Han, D. (2023). Eye-tracking-based VR interactive games for eye movements. <em>Korea Multimedia Society Conference 2023</em>.
                        </div>
                        <div class="pub-item">
                            Yoon, D., Park, S., Song, Y., <strong>Chae, J.</strong>, & Chung, D. (2023). Methodology for improving the performance of demand forecasting through machine learning. <em>Preprint available at Research Square</em>.<br>
                            <a href="https://doi.org/10.21203/rs.3.rs-2637740/v1" class="pub-link" target="_blank">View Preprint</a>
                        </div>
                        <div class="pub-item">
                            Yoo, S., <strong>Chae, J.</strong>, Kim, H., Lee, Y., Kim, S., Kim, Y., & Han, S. (2022). Explored systematic exposure methods influenced by spatiotemporal factors in VR treatment for cynophobia. <em>Korea Multimedia Society Conference 2022</em>.
                        </div>
                        <div class="pub-item">
                            Park, S., Yoon, D., <strong>Chae, J.</strong>, Song, Y., & Chung, D. (2022). Enhanced predictive model performance through clustering. <em>Korea Society of Management Information Systems Conference 2022</em>.
                        </div>
                        <div class="pub-item">
                            Park, S., Yoon, D., Song, Y., <strong>Chae, J.</strong>, & Chung, D. (2022). Combined regression coefficient reduction method with clustering for performance enhancement. <em>Korea Intelligent Information Systems Society Conference 2022</em>.
                        </div>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Research Project Experience</h2>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3>Inclusive Conversational AI Service for Game Accessibility Enhancement</h3>
                            <span class="meta">May 2024 – Apr 2027</span>
                        </div>
                        <div class="org">Student Researcher Lead | KAIST | National Research Foundation of Korea (NRF)</div>
                        <ul>
                            <li>User research and technical development of a conversational AI agent designed to bridge the digital divide for gamers with disabilities.</li>
                            <li>Participatory design workshops to integrate the lived experiences of PWDs into the AI training loop, ensuring ethical applicability.</li>
                            <li>Establishing a cross-sector consortium to standardize accessibility guidelines. Collaborators: Samsung Electronics, Nexon Intelligence Labs, Smilegate D&I, Korea National Rehabilitation Center, SpecialEffect.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Preserving the Haenyeo Legacy: Serious Games for Social Impact</h3>
                            <span class="meta">Jun 2025 – Sep 2025</span>
                        </div>
                        <div class="org">Student Researcher | KAIST | Leverhulme Trust International Fellow</div>
                        <ul>
                            <li>Co-designing a serious game to archive and promote the UNESCO Intangible Cultural Heritage of the Jeju Haenyeo.</li>
                            <li>Designing gamified narratives highlighting environmental stewardship and the role of women in fisheries to drive climate action.</li>
                            <li>Facilitating global academic exchange between Korea and the UK. Partners: Brunel University London, Jeju Haenyeo Museum, local Haenyeo communities.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Real-Time XR Interface Technology for Environmental Adaptation</h3>
                            <span class="meta">Apr 2024 – Jun 2025</span>
                        </div>
                        <div class="org">Student Researcher | KAIST | Institute for Information & Communication Technology Planning & Evaluation (IITP)</div>
                        <ul>
                            <li>Engineering a scalable XR platform capable of managing "Meta-Objects" that adapt to real-world physical constraints in real-time.</li>
                            <li>Developing immersive visual-haptic interfaces integrating multi-sensory feedback systems. Partners: Fraunhofer Institute, NYU, UniSA, Anipen, bHaptics.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Defense Technology Research: Camouflage Effectiveness</h3>
                            <span class="meta">Apr 2023 – Feb 2024</span>
                        </div>
                        <div class="org">Student Researcher | Handong Global University | Korea Aerospace Industries (KAI)</div>
                        <ul>
                            <li>Executed quantitative analysis on the visual stealth capabilities of the KF-21 Boramae fighter jet, simulating various altitudes and climatic conditions.</li>
                            <li>Processed environmental data to evaluate camouflage performance across diverse geographical contexts, suggesting new patterns and colors.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Smart City Infrastructure & AI Object Tracking</h3>
                            <span class="meta">Jan 2023 – Feb 2024</span>
                        </div>
                        <div class="org">Student Researcher | Handong Global University</div>
                        <ul>
                            <li>Architected IoT data collection units for urban road systems, utilizing 3D printing for rapid prototyping of sensor housings.</li>
                            <li>Deployed proprietary AI computer vision algorithms, implementing dynamic anchor box clustering to optimize object tracking accuracy.</li>
                        </ul>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Patent</h2>
                    <div class="card">
                        <div class="card-header">
                            <h3>Artificial Intelligence-Based Technology Acceptance Prediction Method, Program, and Device</h3>
                            <span class="meta">Dec 2022</span>
                        </div>
                        <div class="org">Co-Patentor: Impactive AI Corp. | Korean Intellectual Property Office</div>
                        <ul>
                            <li>Patent Application Publication Number: 40-2022-0179493</li>
                        </ul>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Honors & Awards</h2>
                    
                    <div class="card">
                        <div class="card-header">
                            <h3>Selected Entrepreneurial Team (Climate Tech Track)</h3>
                            <span class="meta">Mar 2024</span>
                        </div>
                        <div class="org">Asan Nanum Foundation | Chung Ju-yung Startup Competition & Asan UniverCT</div>
                        <ul>
                            <li>Selected as a representative startup team for the incubation program, fostering climate-tech innovators.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Grand Prize (President's Award)</h3>
                            <span class="meta">Jan 2024</span>
                        </div>
                        <div class="org">Pohang Culture & Arts Factory Hackathon</div>
                        <ul>
                            <li>Directed technical implementation of a large-scale media facade using Unreal Engine, demonstrating the "Smart City" concept.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Excellence Award</h3>
                            <span class="meta">Jun 2023</span>
                        </div>
                        <div class="org">National Metaverse Developer Contest | Ministry of Science and ICT (MSIT)</div>
                        <ul>
                            <li>Engineered a gamified digital therapeutic for eye muscle rehabilitation utilizing Meta Quest Pro’s eye-tracking.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Outstanding Student Research Award</h3>
                            <span class="meta">Nov 2023</span>
                        </div>
                        <div class="org">Korea Multimedia Society (KMMS)</div>
                        <ul>
                            <li>Presented research on "Eye-tracking-based VR Interactive Games," analyzing occulomotor responses.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Handong Global University President's Award</h3>
                            <span class="meta">Nov 2022</span>
                        </div>
                        <div class="org">Handong Global University | Startup Idea Competition</div>
                        <ul>
                            <li>Conceptualized a high-impact startup business model integrating ESG principles with Augmented Reality (AR).</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Outstanding Student Research Award</h3>
                            <span class="meta">May 2022</span>
                        </div>
                        <div class="org">Korea Multimedia Society (KMMS)</div>
                        <ul>
                            <li>Conducted experimental research on VR exposure therapy for cynophobia, proposing novel spatiotemporal design factors.</li>
                        </ul>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3>Top 14 Finalist</h3>
                            <span class="meta">May 2021</span>
                        </div>
                        <div class="org">Seoul National University (SNU) Business School | DB-SNUbiz Global Startup Challenge</div>
                        <ul>
                            <li>Pitched a blockchain-based solution, validating the business model in a competitive global startup challenge.</li>
                        </ul>
                    </div>
                </section>

                <section class="reveal">
                    <h2>Certifications</h2>
                    <ul class="cert-list">
                        <li>TOEIC 920</li>
                        <li>AI-900: Microsoft Azure, Machine Learning, and AI</li>
                    </ul>
                </section>

            </main>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const observerOptions = {
                root: null,
                rootMargin: '0px',
                threshold: 0.1 // Adjusted for longer cards
            };

            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('active');
                    }
                });
            }, observerOptions);

            const revealElements = document.querySelectorAll('.reveal:not(.active)');
            revealElements.forEach(el => observer.observe(el));
        });
    </script>
</body>
</html>
