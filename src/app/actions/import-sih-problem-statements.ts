"use server";

import { requireAdmin } from "@/lib/auth/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { validateCsrfToken, CSRF_CONSTANTS } from "@/lib/csrf-server";

export interface SIHProblemStatement {
  internalReference: string;
  sihPsNumber: string;
  title: string;
  description: string;
  organization: string;
  theme: string;
  category: "Software" | "Hardware";
  department: "CSE / AIML" | "Electronics and Communication" | "Mechanical" | "Civil";
  sihYear: number;
  displayOrder: number;
  summary: string;
}

const SIH_PROBLEM_STATEMENTS: SIHProblemStatement[] = [
  {
    internalReference: "CS-01",
    sihPsNumber: "SIH25001",
    title: "Smart Community Health Monitoring and Early Warning System for Water-Borne Diseases in Rural Northeast India",
    description: "Water-borne diseases such as diarrhoea, typhoid and hepatitis A repeatedly affect remote villages of the North East, where hilly terrain, heavy monsoons and scattered settlements make it difficult for health departments to notice an outbreak until many people are already sick. Reports from health workers arrive late, water quality is tested rarely and the two sets of information are never combined. This case study asks teams to design a smart monitoring and early warning system that brings together community health reports, symptom trends, water quality readings and rainfall data to detect an emerging outbreak and alert health officials and villagers in time. Teams must consider low connectivity, local languages, data privacy and the limited training of frontline workers. A strong solution explains the data sources, the prediction or anomaly detection approach, the alert workflow, the village-level interface and how success would be measured.",
    organization: "Ministry of Development of North Eastern Region",
    theme: "MedTech / BioTech / HealthTech",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 1,
    summary: "Design a smart monitoring and early warning system combining community health reports, symptom trends, water quality readings and rainfall data to detect water-borne disease outbreaks in remote Northeast Indian villages."
  },
  {
    internalReference: "CS-02",
    sihPsNumber: "SIH25002",
    title: "Smart Tourist Safety Monitoring and Incident Response System using AI, Geo-Fencing and Blockchain-Based Digital ID",
    description: "Tourism is a major opportunity for the North East, but tourists visiting remote, forested and border areas face risks such as getting lost, sudden weather changes, accidents and, at times, crime, while emergency response is slow because the exact location and identity of the visitor are unknown. This case study asks teams to build a tourist safety platform that issues a secure digital identity to visitors, uses geo-fencing to warn them when they enter risky zones, detects unusual behaviour such as prolonged inactivity or route deviation, and triggers a fast incident response to the nearest police or rescue unit. Teams must balance safety with privacy, work in areas of weak network coverage and keep the experience simple for foreign and domestic tourists alike. The proposal should cover the identity design, the AI-based alerting, the response workflow and the control-room dashboard for authorities.",
    organization: "Ministry of Development of North Eastern Region",
    theme: "Travel & Tourism",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 2,
    summary: "Build a tourist safety platform with secure digital identity, geo-fencing alerts, AI-based anomaly detection and fast incident response for remote Northeast tourist areas."
  },
  {
    internalReference: "CS-03",
    sihPsNumber: "SIH25004",
    title: "Image-Based Breed Recognition for Cattle and Buffaloes of India",
    description: "India has dozens of recognised cattle and buffalo breeds, and correct breed identification is essential for registration, breeding programmes, milk-yield planning and government schemes, yet it is still done by trained experts through visual inspection, which is slow and inconsistent in the field. This case study asks teams to develop an image-based system that recognises the breed of a cattle or buffalo from photographs taken on an ordinary smartphone. Teams must deal with very similar-looking breeds, variation in age and body posture, cluttered backgrounds, different lighting and a limited availability of well-labelled images. The system should be usable by field workers with little training and in areas with poor connectivity. A good solution describes data collection, the model architecture, handling of uncertain predictions, the mobile workflow and how accuracy will be validated with veterinary experts.",
    organization: "Ministry of Fisheries, Animal Husbandry & Dairying",
    theme: "Agriculture, FoodTech & Rural Development",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 3,
    summary: "Develop an image-based breed recognition system for Indian cattle and buffaloes from smartphone photos, handling similar breeds, varied poses, lighting and limited labelled data."
  },
  {
    internalReference: "CS-04",
    sihPsNumber: "SIH25013",
    title: "Real-Time Public Transport Tracking for Small Cities",
    description: "In small and medium cities, passengers wait at stops without knowing when the next bus will arrive, which discourages public transport use and pushes people toward private vehicles, while operators have little visibility into delays, bunching and route performance. Large cities use expensive intelligent transport systems that small city bus services cannot afford. This case study asks teams to design a low-cost real-time tracking solution for city buses that shows live location and expected arrival time to passengers and gives operators useful operational data. Teams must decide how to collect location data affordably, for example through low-cost GPS units or driver smartphones, handle poor network coverage and unreliable schedules, and make the passenger interface simple for people with basic phones. A strong proposal covers the architecture, arrival time estimation, the passenger and operator interfaces, privacy of drivers and a rollout plan for a pilot city.",
    organization: "Government of Punjab",
    theme: "Transportation & Logistics",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 4,
    summary: "Design a low-cost real-time bus tracking solution for small cities showing live location and arrival times to passengers and operational data to operators."
  },
  {
    internalReference: "CS-05",
    sihPsNumber: "SIH25022",
    title: "Maximizing Section Throughput Using AI-Powered Precise Train Traffic Control",
    description: "A railway section can carry only a limited number of trains, and every delay, unplanned halt or poor crossing decision reduces the number of trains that actually pass through it. Section controllers currently make many of these decisions using experience and fixed rules, which becomes difficult as traffic grows and as passenger, freight and priority trains compete for the same tracks. This case study asks teams to build an AI-powered decision support system that recommends precise train movements, such as precedence, crossing and holding decisions, to maximise throughput while respecting safety rules and punctuality of priority trains. Teams must model block sections, signalling constraints and train characteristics, and handle disruptions in real time. A good solution explains the optimisation or reinforcement learning approach, a simulation to compare against current practice, the controller interface and how recommendations are explained and validated.",
    organization: "Ministry of Railways",
    theme: "Transportation & Logistics",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 5,
    summary: "Build an AI-powered decision support system for railway section controllers to maximise train throughput through precise precedence, crossing and holding decisions."
  },
  {
    internalReference: "CS-06",
    sihPsNumber: "SIH25029",
    title: "Authenticity Validator for Academia",
    description: "Fake degree certificates, forged mark sheets and manipulated transcripts are a growing problem for universities, employers and government recruiters, and verifying a document today usually means writing to the issuing institution and waiting for weeks. Honest students suffer delays while forged documents sometimes pass unnoticed. This case study asks teams to design an authenticity validator that lets institutions, employers and agencies check the genuineness of academic documents quickly and reliably. Teams may combine document forensics, secure QR codes or digital signatures, institution registries and tamper-evident storage. Challenges include supporting scanned and legacy documents with very different formats, keeping the process simple for small colleges, protecting student data and handling disputes. A strong proposal includes the validation workflow, the technology used to detect tampering, the onboarding approach for institutions and the reporting available to verifiers.",
    organization: "Government of Jharkhand",
    theme: "Smart Education",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 6,
    summary: "Design an authenticity validator for academic documents combining document forensics, secure QR codes, digital signatures and institution registries for quick verification."
  },
  {
    internalReference: "CS-07",
    sihPsNumber: "SIH25038",
    title: "Blockchain-Based Blue Carbon Registry and MRV System",
    description: "Coastal ecosystems such as mangroves, seagrass meadows and salt marshes store large amounts of carbon, and restoring them can generate carbon credits, but projects need trustworthy ways to measure, report and verify the carbon actually captured. Without transparent records, credits can be double counted or overstated, and small community projects are left out. This case study asks teams to design a blockchain-based registry and monitoring, reporting and verification (MRV) system for blue carbon projects. Teams must decide how to combine satellite imagery, field surveys and sensor data to estimate carbon stock, how to record project ownership and credit issuance immutably, and how to let communities and auditors take part. A strong solution describes the data pipeline, the estimation approach, the registry design, safeguards against fraud and a simple interface for project owners.",
    organization: "Ministry of Earth Sciences (MoES)",
    theme: "Clean & Green Technology",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 7,
    summary: "Design a blockchain-based registry and MRV system for blue carbon projects combining satellite imagery, field surveys and sensor data to estimate carbon stock immutably."
  },
  {
    internalReference: "CS-08",
    sihPsNumber: "SIH25039",
    title: "Integrated Platform for Crowdsourced Ocean Hazard Reporting and Social Media Analytics",
    description: "Coastal communities are often the first to see signs of ocean hazards such as unusually high waves, flooding, swell surges, oil spills or abnormal sea behaviour, but their observations rarely reach forecasting agencies quickly or in a usable form. At the same time, social media carries many relevant posts that are buried in noise. This case study asks teams to build a platform where citizens, fishers and volunteers can report ocean hazards with photos, location and short descriptions, and where social media and news streams are analysed to detect emerging hazard signals. Teams must handle false reports, multilingual and informal text, geo-tagging and the need to present verified information to authorities in time. A good proposal covers the reporting app, the text and image analysis pipeline, validation methods, the situational dashboard and how alerts flow back to coastal communities.",
    organization: "Ministry of Earth Sciences (MoES)",
    theme: "Disaster Management",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 8,
    summary: "Build a platform for crowdsourced ocean hazard reporting with social media analytics to detect emerging hazard signals and alert authorities."
  },
  {
    internalReference: "CS-09",
    sihPsNumber: "SIH25040",
    title: "FloatChat: AI-Powered Conversational Interface for ARGO Ocean Data Discovery and Visualization",
    description: "The ARGO programme deploys autonomous floats that measure temperature, salinity and other properties of the ocean, producing a vast and valuable dataset, but the data is stored in specialised scientific formats that are difficult for students, policymakers and even many researchers to explore. This case study asks teams to build a conversational interface that lets users ask questions in plain language, such as how surface temperature has changed in a region, and receive the right data, charts and explanations. Teams must design a pipeline that converts questions into reliable data queries, handles large scientific datasets efficiently, produces correct visualisations and avoids confidently giving wrong answers. A strong solution describes the data ingestion and indexing, the language model and retrieval approach, safeguards for accuracy, the visualisation layer and the way answers cite the underlying data.",
    organization: "Ministry of Earth Sciences (MoES)",
    theme: "Miscellaneous",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 9,
    summary: "Build a conversational AI interface for ARGO ocean data discovery allowing plain-language queries with data, charts and cited sources."
  },
  {
    internalReference: "CS-10",
    sihPsNumber: "SIH25050",
    title: "Smart Traffic Management System for Urban Congestion",
    description: "Rapid urban growth has left many Indian cities with congested junctions, long waiting times and rising pollution, while traffic signals still run on fixed timers that cannot respond to the real flow of vehicles. Indian traffic adds further complexity through mixed vehicle types, informal parking and unpredictable behaviour. This case study asks teams to design a smart traffic management system that senses traffic conditions, adapts signals and informs drivers and authorities in real time. Teams may use cameras, existing sensors or mobile data, and must handle poor weather and lighting, coordinate multiple junctions and give priority to emergency vehicles. A strong proposal explains the sensing approach, the control algorithm, a simulation demonstrating reduced delay, the way emergency vehicles are detected and the dashboard used by traffic police for monitoring and planning.",
    organization: "Government of Odisha",
    theme: "Transportation & Logistics",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 10,
    summary: "Design a smart traffic management system using cameras, sensors or mobile data to adapt signals in real time, coordinate junctions and prioritize emergency vehicles."
  },
  {
    internalReference: "CS-11",
    sihPsNumber: "SIH25071",
    title: "AI-Based Rockfall Prediction and Alert System for Open-Pit Mines",
    description: "Rockfalls and slope failures in open-pit mines are a leading cause of accidents and equipment damage, and they are difficult to predict because they depend on geology, rainfall, blasting, slope geometry and the gradual movement of the rock mass. Current monitoring relies on periodic inspection and a limited number of instruments. This case study asks teams to develop an AI-based system that predicts the likelihood of rockfall in different parts of a mine and sends timely alerts to supervisors and workers. Teams may combine slope stability data, sensor readings, drone or radar imagery, weather and blasting records. Challenges include limited failure data, the high cost of false alarms versus missed alarms, and the need to deliver warnings in noisy mine environments. A strong solution describes the data sources, the prediction approach, the risk map, the alert system and validation using past incidents.",
    organization: "Ministry of Mines",
    theme: "Disaster Management",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 11,
    summary: "Develop an AI-based rockfall prediction system for open-pit mines combining slope data, sensor readings, drone imagery, weather and blasting records with timely alerts."
  },
  {
    internalReference: "CS-12",
    sihPsNumber: "SIH25099",
    title: "AI-Powered Monitoring of Crop Health, Soil Condition and Pest Risks using Multispectral/Hyperspectral Imaging and Sensor Data",
    description: "Precision agriculture depends on knowing, field by field and week by week, how healthy the crop is, what the soil needs and where pests are likely to appear, but conventional scouting is slow, subjective and impossible at the scale of large farms. Multispectral and hyperspectral imaging from drones or satellites, together with field sensors, can reveal stress long before it is visible to the eye. This case study asks teams to build an AI-powered system that processes such imagery and sensor data to monitor crop health, soil condition and pest risk and turns the results into clear recommendations for farmers. Challenges include large data volumes, calibration between sensors, limited labelled data and presenting results in a form that non-experts can act upon. A good proposal explains the data pipeline, the models, the validation method and the farmer-facing interface.",
    organization: "MathWorks India Pvt. Ltd.",
    theme: "Agriculture, FoodTech & Rural Development",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 12,
    summary: "Build an AI system processing multispectral/hyperspectral imaging and sensor data to monitor crop health, soil condition and pest risks with farmer-facing recommendations."
  },
  {
    internalReference: "CS-13",
    sihPsNumber: "SIH25102",
    title: "AI-Based Drop-Out Prediction and Counseling System",
    description: "A significant number of students leave school or college before completing their course, usually after a period of falling attendance, weak performance, financial stress or personal difficulty that nobody connected in time. Teachers and counsellors are stretched thin and lack tools to spot which students need help first. This case study asks teams to build an AI-based system that uses attendance, assessment results and other available indicators to predict which students are at risk of dropping out and to support timely counselling. The system must be fair and explainable, avoid labelling students unfairly, respect privacy and fit into the daily workflow of teachers. A strong solution describes the risk model, the explanation shown to counsellors, the intervention and follow-up workflow, safeguards against bias and a plan to measure whether interventions actually reduce dropouts.",
    organization: "Government of Rajasthan",
    theme: "Smart Automation",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 13,
    summary: "Build an AI-based drop-out prediction system using attendance and assessment data with explainable risk models, counsellor tools and intervention workflows."
  },
  {
    internalReference: "CS-14",
    sihPsNumber: "SIH25104",
    title: "Language Agnostic Chatbot",
    description: "Students, parents and citizens interact with institutions and departments in many languages, but most chatbots work well in only one or two, leaving large groups without help for admissions, schemes, schedules and common queries. This case study asks teams to build a chatbot that understands and answers in whatever language the user writes or speaks, including mixed-language text commonly used on phones. Teams must address language detection, translation or multilingual understanding, accurate retrieval of institutional information and graceful handling of questions the bot cannot answer. Voice support, low-bandwidth operation and easy updating of the knowledge base by non-technical staff are important practical requirements. A strong proposal describes the architecture, the language handling approach, how answers are grounded in official content, evaluation across several languages and the escalation path to a human.",
    organization: "Government of Rajasthan",
    theme: "Smart Education",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 14,
    summary: "Build a multilingual chatbot understanding mixed-language text with voice support, low-bandwidth operation and easy knowledge base updates for institutional queries."
  },
  {
    internalReference: "CS-15",
    sihPsNumber: "SIH25092",
    title: "Digital Mental Health and Psychological Support System for Students in Higher Education",
    description: "Students in higher education face academic pressure, isolation, financial worries and uncertainty about careers, yet many hesitate to seek help because of stigma, limited counselling staff and lack of privacy. Problems often become serious before anyone notices. This case study asks teams to design a digital mental health and psychological support system for college students that offers confidential self-assessment, guided support, access to trained counsellors and, where needed, escalation to professional help. The solution must be sensitive, safe and clearly not a replacement for clinical care, with strong privacy protection and careful handling of crisis situations. Teams should consider anonymity, multilingual access, peer support, awareness content and ways to help institutions understand overall wellbeing trends without exposing individuals. A strong proposal covers the user journey, safety design, counsellor tools and the plan for responsible deployment.",
    organization: "Government of Jammu and Kashmir",
    theme: "MedTech / BioTech / HealthTech",
    category: "Software",
    department: "CSE / AIML",
    sihYear: 2025,
    displayOrder: 15,
    summary: "Design a digital mental health platform for college students with confidential self-assessment, guided support, counsellor access and crisis escalation with strong privacy protection."
  },
  {
    internalReference: "EC-01",
    sihPsNumber: "SIH25051",
    title: "Renewable Energy Monitoring System for Microgrids",
    description: "Solar-based microgrids are increasingly used in villages, campuses and remote facilities, but operators often lack real-time visibility into how much energy is generated, stored and consumed, so faults, battery degradation and wasteful usage go unnoticed until supply fails. Commercial monitoring systems are expensive and difficult to maintain locally. This case study asks teams to design a low-cost hardware monitoring solution that tracks generation, storage and load in real time and alerts operators to abnormal behaviour. Teams must choose accurate and affordable sensors, a reliable data link such as LoRa, GSM or Wi-Fi, and a dashboard that a local technician can understand. A strong answer also includes basic fault prediction, for example detecting declining panel output or battery health, along with a realistic cost estimate and a power-efficient design.",
    organization: "Government of Odisha",
    theme: "Renewable / Sustainable Energy",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 16,
    summary: "Design a low-cost hardware monitoring system for solar microgrids tracking generation, storage and load with real-time alerts and fault prediction."
  },
  {
    internalReference: "EC-02",
    sihPsNumber: "SIH25021",
    title: "AI-Based Development of Laser-Based QR Code Marking on Track Fittings on Indian Railways",
    description: "Indian Railways uses millions of track fittings such as elastic rail clips, liners and pads, and the lack of permanent identification makes it hard to trace a component's manufacturer, batch, installation date and inspection history. When a failure occurs, identifying the affected batch is slow and expensive. This case study asks teams to develop a system for marking QR or data-matrix codes on track fittings using laser technology, supported by AI for quality checking and reliable reading in the field. The marking must be durable on metal and rubber surfaces exposed to dust, rust, rain and vibration, and the reader must work in poor light and on dirty surfaces. A good proposal covers the marking method, code design, vision-based verification, mobile reading, database integration and reliability testing.",
    organization: "Ministry of Railways",
    theme: "Transportation & Logistics",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 17,
    summary: "Develop laser-based QR code marking on railway track fittings with AI quality verification, durable on metal/rubber, readable in poor conditions."
  },
  {
    internalReference: "EC-03",
    sihPsNumber: "SIH25020",
    title: "Development of Indigenous Contactless Integrated Track Monitoring Systems (ITMS) for Track Recording on Indian Railways",
    description: "Regular measurement of track geometry and condition is essential for safe and comfortable train operation, but traditional track recording relies on contact-based equipment and imported systems that are costly and need specialised vehicles and maintenance. This case study asks teams to develop an indigenous contactless integrated track monitoring system that records track parameters while moving, for example using lasers, cameras and inertial sensors mounted on a rail vehicle. Teams must address measurement accuracy at speed, vibration, varying light and weather, synchronisation of multiple sensors and processing of large data streams. A strong solution describes the sensor suite, the mounting and data acquisition design, the algorithms that convert raw data into track parameters, the accuracy validation approach and a cost comparison with imported systems.",
    organization: "Ministry of Railways",
    theme: "Smart Automation",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 18,
    summary: "Develop an indigenous contactless track monitoring system using lasers, cameras and inertial sensors on rail vehicles with accuracy validation and cost comparison."
  },
  {
    internalReference: "EC-04",
    sihPsNumber: "SIH25036",
    title: "Development of Sensor for Detection of Microplastics",
    description: "Microplastics are now found in oceans, rivers, drinking water and even food, yet detecting and counting them still depends on laboratory methods that are slow, expensive and unsuitable for continuous monitoring. This case study asks teams to develop a sensor that can detect microplastics in water samples quickly and at low cost. Teams may explore optical methods such as fluorescence, scattering or spectroscopy, microfluidic sample handling or electrical sensing. Major challenges include distinguishing plastic particles from organic matter and sand, handling very small particle sizes, calibration and keeping the device portable and affordable for field use. A strong proposal explains the sensing principle, the sample preparation approach, the electronics and signal processing, expected detection limits, validation against laboratory methods and a plan for field deployment.",
    organization: "Ministry of Earth Sciences (MoES)",
    theme: "Miscellaneous",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 19,
    summary: "Develop a low-cost portable sensor for rapid microplastic detection in water using optical, microfluidic or electrical sensing methods."
  },
  {
    internalReference: "EC-05",
    sihPsNumber: "SIH25063",
    title: "Cost-Effective Solution for Detecting Breakage of Low Voltage AC Distribution Overhead Conductors",
    description: "When a low voltage overhead conductor snaps and falls, it can remain live on the ground and cause fatal electric shocks to people and animals, especially during storms and heavy rain, because protection devices often do not trip for such faults. Utilities need a way to detect conductor breakage quickly and isolate the line before harm occurs. This case study asks teams to develop a cost-effective hardware solution that detects the breakage of low voltage AC overhead conductors and signals or disconnects the affected line. Teams must work with the electrical characteristics of distribution networks, avoid false trips from normal load changes and keep the cost low enough to be installed widely. A good solution describes the detection principle, the electronics, the communication to the utility, field installation, testing under realistic fault conditions and a cost estimate.",
    organization: "Government of Kerala",
    theme: "Disaster Management",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 20,
    summary: "Develop cost-effective hardware to detect LV overhead conductor breakage and signal/disconnect the line, avoiding false trips with wide deployment feasibility."
  },
  {
    internalReference: "EC-06",
    sihPsNumber: "SIH25062",
    title: "Implementation of Smart Agriculture for Efficient Cultivation in Hilly Regions",
    description: "Farming in hilly regions such as Sikkim faces steep terrain, small and scattered terraces, variable microclimates, soil erosion and limited access to irrigation and markets, so techniques designed for plains do not work well. This case study asks teams to design a smart agriculture system suited to hill farming that uses sensors and automation to improve water use, monitor soil and weather and guide decisions on planting, irrigation and crop protection. The hardware must be low-power, rugged and able to operate where network coverage is weak, and the interface must be simple for farmers who may not be technically trained. A strong proposal describes the sensing and control hardware, the communication approach, the decision logic, how the system copes with terrain and weather, the cost per farm and the expected benefits for yield and income.",
    organization: "Government of Sikkim",
    theme: "Agriculture, FoodTech & Rural Development",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 21,
    summary: "Design a smart agriculture system for hill farming with low-power rugged sensors, automation for water/soil/weather monitoring and simple farmer interface."
  },
  {
    internalReference: "EC-07",
    sihPsNumber: "SIH25064",
    title: "Improving Renewable Energy Hosting Capacity in Distribution Feeders and Power Quality during High RE Injection",
    description: "As rooftop solar and other renewable sources connect to distribution feeders, the network can face voltage rise, reverse power flow, harmonics and instability, which limits how much renewable energy a feeder can safely accept. This case study asks teams to develop a hardware-based solution that increases the renewable energy hosting capacity of distribution feeders while maintaining power quality when renewable injection is high. Teams may explore power electronic devices, smart inverters with voltage support, energy storage, monitoring and control schemes or reactive power compensation. Challenges include keeping the solution affordable, coordinating many small sources and verifying performance under realistic feeder conditions. A strong proposal explains the problem analysis, the proposed hardware and control approach, simulation results, the communication and monitoring design and the expected improvement in hosting capacity.",
    organization: "Government of Kerala",
    theme: "Renewable / Sustainable Energy",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 22,
    summary: "Develop hardware solution to increase renewable energy hosting capacity of distribution feeders with power quality maintenance during high RE injection."
  },
  {
    internalReference: "EC-08",
    sihPsNumber: "SIH25047",
    title: "Disaster Response Drone for Remote Areas",
    description: "After cyclones, floods and landslides, roads and bridges are often cut off, and relief teams cannot quickly learn where people are stranded or deliver urgent supplies such as medicines, food and communication devices. This case study asks teams to design a drone system for disaster response in remote areas that can survey affected zones, locate survivors and carry small payloads. The drone must operate in wind and rain, cover meaningful distances on limited battery power and be simple enough for relief workers to deploy. Teams must consider the airframe and payload design, sensors such as thermal and visual cameras, navigation without reliable GPS or network, and safe operation. A strong proposal covers the drone architecture, power and range calculations, sensing and communication, a field operation plan and the cost of a deployable unit.",
    organization: "Government of Odisha",
    theme: "Robotics and Drones",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 23,
    summary: "Design a disaster response drone for remote areas with thermal/visual cameras, wind/rain operation, GPS-free navigation and payload delivery capability."
  },
  {
    internalReference: "EC-09",
    sihPsNumber: "SIH25077",
    title: "Hardware to Detect and Prevent Unauthorized Use of Electric Fences",
    description: "Electric fences are widely used to protect farms from wild animals, but when installed or modified illegally, for example by connecting them directly to the mains supply, they can electrocute animals and people. Authorities need an effective way to detect unauthorised or unsafe use and prevent accidents. This case study asks teams to develop a hardware solution that monitors electric fence installations, detects unauthorised connections or unsafe voltage and current levels, and cuts the supply or alerts authorities when a violation occurs. The device must be rugged, weather resistant, low cost and tamper-proof, and must not interfere with legitimate low-energy fence energisers. A strong proposal describes the sensing and detection logic, the protection and switching hardware, the communication with the authority, field testing and how installations can be certified and tracked.",
    organization: "Government of Kerala",
    theme: "Smart Automation",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 24,
    summary: "Develop rugged hardware to monitor electric fences, detect unauthorized mains connections or unsafe voltage/current, and cut supply or alert authorities."
  },
  {
    internalReference: "EC-10",
    sihPsNumber: "SIH25043",
    title: "Embedded Intelligent Microscopy System for Identification and Counting of Microscopic Marine Organisms",
    description: "Plankton and other microscopic marine organisms form the base of the ocean food chain, and monitoring them is important for fisheries, water quality and climate studies, but identifying and counting them under a microscope is slow, tiring and depends on scarce experts. This case study asks teams to develop an embedded, intelligent microscopy system that automatically captures images of water samples and identifies and counts microscopic marine organisms. Teams must design the optics and illumination, sample handling, an embedded processor capable of running image analysis and an AI model trained to distinguish many species from debris. Portability, low power and ease of use on a research vessel or coastal station are important requirements. A strong proposal describes the optical and mechanical design, the imaging pipeline, the model and its training data, accuracy targets and the output format for scientists.",
    organization: "Ministry of Earth Sciences (MoES)",
    theme: "Smart Automation",
    category: "Hardware",
    department: "Electronics and Communication",
    sihYear: 2025,
    displayOrder: 25,
    summary: "Develop an embedded intelligent microscopy system with optics, sample handling, embedded processor and AI model for automated plankton identification and counting."
  },
  {
    internalReference: "ME-01",
    sihPsNumber: "SIH25053",
    title: "Improved Onion Storage Technology for Enhancing Shelf Life of Onions",
    description: "Onion prices swing sharply from season to season because a large part of the crop is lost to rotting, sprouting and weight loss in storage, and traditional storage structures give farmers and traders little control over temperature, humidity and ventilation. This case study asks teams to design an improved onion storage technology that extends shelf life and reduces losses while remaining affordable for farmers and small traders. Teams should study the factors that cause onion spoilage, calculate the airflow, temperature and humidity requirements for a chosen storage capacity, and propose structural design, ventilation or cooling methods and possible use of solar power or low-energy systems. Practical constraints include cost, local materials, ease of loading and unloading and maintenance by users with limited technical skills. A strong proposal includes design calculations, drawings, the control approach, expected reduction in losses and a payback analysis.",
    organization: "Ministry of Consumer Affairs, Food & Public Distribution",
    theme: "Agriculture, FoodTech & Rural Development",
    category: "Hardware",
    department: "Mechanical",
    sihYear: 2025,
    displayOrder: 26,
    summary: "Design improved onion storage technology with controlled temperature, humidity and ventilation using solar/low-energy systems, affordable for farmers."
  },
  {
    internalReference: "ME-02",
    sihPsNumber: "SIH25003",
    title: "Low-Cost Smart Transportation Solution for Agri Produce from Remote Farms to the Nearest Motorable Road in the NER Region",
    description: "In the hills of the North East, many farms lie far from the nearest motorable road, and farmers must carry vegetables, fruits and spices on their backs over steep, narrow paths, which causes damage to the produce, loss of time and physical strain, and reduces the price they finally receive. This case study asks teams to design a low-cost smart transportation solution that moves agricultural produce from remote farms to the nearest motorable road. Options could include ropeways, cable carriers, tracked or small powered carriers and electric or human-assisted vehicles. The design must handle steep slopes, rain, uneven terrain, limited power availability and low cost of building and maintenance by village communities. A strong proposal presents the mechanism, load and power calculations, safety features, the control or tracking element that makes it smart and an estimate of cost per farm cluster.",
    organization: "Ministry of Development of North Eastern Region",
    theme: "Transportation & Logistics",
    category: "Hardware",
    department: "Mechanical",
    sihYear: 2025,
    displayOrder: 27,
    summary: "Design low-cost smart transport (ropeways, cable carriers, tracked vehicles) for agri produce from remote NE farms to motorable roads with load/power calculations."
  },
  {
    internalReference: "ME-03",
    sihPsNumber: "SIH25072",
    title: "Design and Implementation of Solar-Powered Dewatering in Mining Operations",
    description: "Mines must continuously pump out water that collects in pits and underground workings, and this dewatering is one of the largest consumers of diesel and grid electricity in mining, adding to cost and emissions. This case study asks teams to design a solar-powered dewatering system for mining operations. The design must estimate the volume and head of water to be pumped, size the pumps, solar array and any energy storage, and handle variable inflow during rain, dust deposition on panels and the harsh mining environment. Teams should consider hybrid operation with the grid or generators for reliability, safe installation in mining areas and ways to reduce pumping energy. A strong proposal includes hydraulic and electrical calculations, a system layout, the control strategy, an economic comparison with diesel or grid pumping and a plan for maintenance and safety.",
    organization: "Ministry of Mines",
    theme: "Renewable / Sustainable Energy",
    category: "Hardware",
    department: "Mechanical",
    sihYear: 2025,
    displayOrder: 28,
    summary: "Design solar-powered dewatering system for mines with hydraulic/electrical calculations, hybrid grid/generator operation and economic comparison with diesel pumping."
  },
  {
    internalReference: "CE-01",
    sihPsNumber: "SIH25065",
    title: "Application for On-Spot Assessment of Roof Top Rain Water Harvesting and Artificial Recharge Potential and Size of RTRWH and AR Structures",
    description: "Rooftop rainwater harvesting and artificial recharge can significantly improve groundwater levels in cities and villages, but property owners, engineers and officials often lack a quick, reliable way to judge how much water a particular site can harvest and what size of storage or recharge structure is appropriate. This case study asks teams to design an application that performs an on-spot assessment of rooftop rainwater harvesting and artificial recharge potential and recommends the size and type of structure. The app would need to use rooftop area and surface, local rainfall data, soil and groundwater conditions and space available, and then apply sound hydrological and civil engineering calculations. A strong solution explains the inputs and data sources, the calculation method, the recommended structure designs, the user interface for field officers and citizens and the way estimated benefits are presented.",
    organization: "Ministry of Jal Shakti",
    theme: "Smart Automation",
    category: "Software",
    department: "Civil",
    sihYear: 2025,
    displayOrder: 29,
    summary: "Design an app for on-spot assessment of rooftop rainwater harvesting potential using area, rainfall, soil data and hydrological calculations with structure recommendations."
  },
  {
    internalReference: "CE-02",
    sihPsNumber: "SIH25090",
    title: "Grey Water Management and Reuse, Wetland Management and Water Conservation",
    description: "Households, hostels and institutions produce large volumes of grey water from kitchens, bathrooms and laundry, which is usually discharged directly into drains or the soil, wasting a resource that could be reused for gardening, flushing and other non-potable purposes, while also stressing sewage systems and natural wetlands. This case study asks teams to design practical systems for grey water management and reuse, supported by wetland management and water conservation measures. Teams should study the quality and quantity of grey water, propose treatment methods suitable for small and medium scale such as filtration, constructed wetlands and settling units, and design storage and distribution for reuse. Cost, land requirement, odour, maintenance and public acceptance are important constraints. A strong proposal includes design calculations, a layout, expected water savings, monitoring of treated water quality and a plan for operation and maintenance.",
    organization: "Government of Kerala",
    theme: "Clean & Green Technology",
    category: "Hardware",
    department: "Civil",
    sihYear: 2025,
    displayOrder: 30,
    summary: "Design grey water management systems with treatment (filtration, constructed wetlands), storage, distribution for reuse, and wetland management with design calculations."
  }
];

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: Array<{ internalReference: string; error: string }>;
  details: Array<{ internalReference: string; sihPsNumber: string; id: string; action: "inserted" | "skipped" }>;
}

function mapDomain(department: string): string {
  switch (department) {
    case "CSE / AIML":
      return "CSE/AIML";
    case "Electronics and Communication":
      return "ECE/EEE";
    case "Mechanical":
      return "ME/CV";
    case "Civil":
      return "ME/CV";
    default:
      return department;
  }
}

function validateRecord(ps: SIHProblemStatement): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!ps.internalReference || ps.internalReference.trim() === "") {
    errors.push("Missing reference_number (internalReference)");
  }
  if (!ps.sihPsNumber || ps.sihPsNumber.trim() === "") {
    errors.push("Missing sih_ps_number");
  }
  if (!ps.title || ps.title.trim() === "") {
    errors.push("Missing title");
  }
  if (!ps.description || ps.description.trim() === "") {
    errors.push("Missing description");
  }
  if (!ps.department || ps.department.trim() === "") {
    errors.push("Missing department");
  }
  if (!ps.category || (ps.category !== "Software" && ps.category !== "Hardware")) {
    errors.push("Invalid category (must be Software or Hardware)");
  }
  if (!Number.isInteger(ps.sihYear) || ps.sihYear < 2020 || ps.sihYear > 2030) {
    errors.push("Invalid sih_year");
  }
  if (!Number.isInteger(ps.displayOrder) || ps.displayOrder < 1 || ps.displayOrder > 30) {
    errors.push("Invalid display_order");
  }
  if (!ps.organization || ps.organization.trim() === "") {
    errors.push("Missing organization");
  }
  if (!ps.theme || ps.theme.trim() === "") {
    errors.push("Missing theme");
  }

  return { valid: errors.length === 0, errors };
}

async function preflightValidation(): Promise<{
  valid: boolean;
  recordResults: Array<{ internalReference: string; sihPsNumber: string; valid: boolean; errors: string[] }>;
}> {
  const recordResults: Array<{ internalReference: string; sihPsNumber: string; valid: boolean; errors: string[] }> = [];

  for (const ps of SIH_PROBLEM_STATEMENTS) {
    const validation = validateRecord(ps);
    recordResults.push({
      internalReference: ps.internalReference,
      sihPsNumber: ps.sihPsNumber,
      valid: validation.valid,
      errors: validation.errors,
    });
  }

  const allValid = recordResults.every(r => r.valid);
  return { valid: allValid, recordResults };
}

export async function importSIHProblemStatements(input: {
  [CSRF_CONSTANTS.HEADER_NAME]?: string;
}): Promise<ImportResult> {
  await requireAdmin();
  await validateCsrfToken(input[CSRF_CONSTANTS.HEADER_NAME] || null);

  // Preflight validation
  const preflight = await preflightValidation();
  if (!preflight.valid) {
    const errorDetails = preflight.recordResults
      .filter(r => !r.valid)
      .map(r => `${r.internalReference} (${r.sihPsNumber}): ${r.errors.join("; ")}`)
      .join("\n");
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: preflight.recordResults
        .filter(r => !r.valid)
        .map(r => ({ internalReference: r.internalReference, error: r.errors.join("; ") })),
      details: [],
    };
  }

  // Duplicate check for all records before any insert
  const duplicateCheck: Array<{ internalReference: string; sihPsNumber: string; conflict: string }> = [];
  for (const ps of SIH_PROBLEM_STATEMENTS) {
    const { data: existingBySih } = await supabaseAdmin
      .from("problem_statements")
      .select("id, reference_number, sih_ps_number, status")
      .eq("sih_ps_number", ps.sihPsNumber)
      .maybeSingle();
    if (existingBySih) {
      duplicateCheck.push({ internalReference: ps.internalReference, sihPsNumber: ps.sihPsNumber, conflict: "sih_ps_number" });
    }
    const { data: existingByRef } = await supabaseAdmin
      .from("problem_statements")
      .select("id")
      .eq("reference_number", ps.internalReference)
      .maybeSingle();
    if (existingByRef) {
      duplicateCheck.push({ internalReference: ps.internalReference, sihPsNumber: ps.sihPsNumber, conflict: "reference_number" });
    }
  }

  if (duplicateCheck.length > 0) {
    return {
      success: false,
      imported: 0,
      skipped: 0,
      errors: duplicateCheck.map(d => ({ 
        internalReference: d.internalReference, 
        error: `Duplicate ${d.conflict}: ${d.sihPsNumber} (${d.internalReference})` 
      })),
      details: [],
    };
  }

  const result: ImportResult = {
    success: true,
    imported: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  const { data: { user } } = await supabaseAdmin.auth.getUser();

  for (const ps of SIH_PROBLEM_STATEMENTS) {
    try {
      // Check if already exists by SIH PS number (unique)
      const { data: existingBySih, error: checkError } = await supabaseAdmin
        .from("problem_statements")
        .select("id, reference_number, sih_ps_number, status")
        .eq("sih_ps_number", ps.sihPsNumber)
        .maybeSingle();

      if (checkError) {
        result.errors.push({ internalReference: ps.internalReference, error: checkError.message });
        result.success = false;
        continue;
      }

      if (existingBySih) {
        result.skipped++;
        result.details.push({
          internalReference: ps.internalReference,
          sihPsNumber: ps.sihPsNumber,
          id: existingBySih.id,
          action: "skipped"
        });
        continue;
      }

      // Also check by reference_number (unique) to avoid conflicts
      const { data: existingByRef } = await supabaseAdmin
        .from("problem_statements")
        .select("id")
        .eq("reference_number", ps.internalReference)
        .maybeSingle();

      if (existingByRef) {
        result.errors.push({ 
          internalReference: ps.internalReference, 
          error: `reference_number "${ps.internalReference}" already exists` 
        });
        result.success = false;
        continue;
      }

      // Insert new problem statement with all required columns
      const now = new Date().toISOString();
      const payload = {
        reference_number: ps.internalReference,        // CS-01, EC-01, etc.
        sih_ps_number: ps.sihPsNumber,                  // SIH25001, etc.
        title: ps.title,
        domain: mapDomain(ps.department),               // eligibility domain
        department: ps.department,                      // original department
        summary: ps.summary,
        description: ps.description,                    // full PDF description
        organization: ps.organization,
        theme: ps.theme,
        category: ps.category,                          // Software / Hardware
        sih_year: ps.sihYear,
        display_order: ps.displayOrder,
        source_document: "Ideathon_Case_Studies.pdf",
        status: "draft",
        is_visible_to_teams: false,
        selection_enabled: false,
        enable_selection: false,
        manually_locked: false,
        manual_lock: false,
        team_limit: null,
        max_teams: null,
        selection_opening: null,
        selection_closing: null,
        selection_open_at: null,
        selection_close_at: null,
        publication_timezone: "Asia/Kolkata",
        objectives: [],
        deliverables: [],
        constraints: [],
        evaluation_criteria: [],
        resource_links: [],
        attachments: [],
        draft_content: {},
        published_content: {},
        created_by: user?.id,
        updated_by: user?.id,
        created_at: now,
        updated_at: now,
        published_at: null,
        published_by: null,
      };

      // Runtime validation before insert
      const jsonbFields = ['objectives', 'deliverables', 'constraints', 'evaluation_criteria', 'resource_links', 'attachments'] as const;
      for (const field of jsonbFields) {
        const value = payload[field];
        if (!Array.isArray(value)) {
          throw new Error(`Pre-insert validation failed for ${ps.internalReference}: ${field} is not an array (got ${typeof value}: ${JSON.stringify(value)})`);
        }
      }

      // Debug log for CS-01
      if (ps.internalReference === "CS-01") {
        console.log("[SIH Import] CS-01 payload JSONB fields:", {
          objectives: payload.objectives,
          deliverables: payload.deliverables,
          constraints: payload.constraints,
          evaluation_criteria: payload.evaluation_criteria,
          resource_links: payload.resource_links,
          attachments: payload.attachments,
        });
      }

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("problem_statements")
        .insert(payload)
        .select("id")
        .single();

      if (insertError) {
        result.errors.push({ internalReference: ps.internalReference, error: insertError.message });
        result.success = false;
        continue;
      }

      result.imported++;
      result.details.push({
        internalReference: ps.internalReference,
        sihPsNumber: ps.sihPsNumber,
        id: inserted.id,
        action: "inserted"
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push({ internalReference: ps.internalReference, error: errorMessage });
      result.success = false;
    }
  }

  revalidatePath("/admin/content-releases");
  revalidatePath("/team/problem-statements");

  return result;
}

export async function getSIHProblemStatementsPreview(): Promise<{
  total: number;
  byDepartment: Record<string, number>;
  byCategory: Record<string, number>;
  statements: Array<{
    internalReference: string;
    sihPsNumber: string;
    title: string;
    department: string;
    category: string;
    organization: string;
  }>;
}> {
  await requireAdmin();

  const byDepartment: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const ps of SIH_PROBLEM_STATEMENTS) {
    byDepartment[ps.department] = (byDepartment[ps.department] || 0) + 1;
    byCategory[ps.category] = (byCategory[ps.category] || 0) + 1;
  }

  return {
    total: SIH_PROBLEM_STATEMENTS.length,
    byDepartment,
    byCategory,
    statements: SIH_PROBLEM_STATEMENTS.map(ps => ({
      internalReference: ps.internalReference,
      sihPsNumber: ps.sihPsNumber,
      title: ps.title,
      department: ps.department,
      category: ps.category,
      organization: ps.organization
    }))
  };
}

export async function verifySIHImport(): Promise<{
  totalInDB: number;
  expectedTotal: number;
  byDepartment: Record<string, { expected: number; actual: number }>;
  byCategory: Record<string, { expected: number; actual: number }>;
  missingPSNumbers: string[];
  duplicatePSNumbers: string[];
  allDraft: boolean;
  details: Array<{ sihPsNumber: string; title: string; department: string; category: string; status: string }>;
}> {
  await requireAdmin();

  const { data: dbRecords, error } = await supabaseAdmin
    .from("problem_statements")
    .select("sih_ps_number, title, department, category, status")
    .not("sih_ps_number", "is", null);

  if (error) {
    throw new Error(`Failed to fetch problem statements: ${error.message}`);
  }

  const expectedByDept: Record<string, number> = {};
  const expectedByCat: Record<string, number> = {};
  const expectedPSNumbers = new Set<string>();

  for (const ps of SIH_PROBLEM_STATEMENTS) {
    expectedByDept[ps.department] = (expectedByDept[ps.department] || 0) + 1;
    expectedByCat[ps.category] = (expectedByCat[ps.category] || 0) + 1;
    expectedPSNumbers.add(ps.sihPsNumber);
  }

  const actualByDept: Record<string, number> = {};
  const actualByCat: Record<string, number> = {};
  const foundPSNumbers = new Set<string>();
  const duplicatePSNumbers: string[] = [];

  for (const record of dbRecords || []) {
    if (record.sih_ps_number) {
      if (foundPSNumbers.has(record.sih_ps_number)) {
        duplicatePSNumbers.push(record.sih_ps_number);
      }
      foundPSNumbers.add(record.sih_ps_number);
    }
    actualByDept[record.department] = (actualByDept[record.department] || 0) + 1;
    actualByCat[record.category] = (actualByCat[record.category] || 0) + 1;
  }

  const missingPSNumbers = Array.from(expectedPSNumbers).filter(ps => !foundPSNumbers.has(ps));
  const allDraft = (dbRecords || []).every(r => r.status === "draft");

  const deptKeys = new Set([...Object.keys(expectedByDept), ...Object.keys(actualByDept)]);
  const catKeys = new Set([...Object.keys(expectedByCat), ...Object.keys(actualByCat)]);

  const byDepartment: Record<string, { expected: number; actual: number }> = {};
  for (const key of deptKeys) {
    byDepartment[key] = {
      expected: expectedByDept[key] || 0,
      actual: actualByDept[key] || 0
    };
  }

  const byCategory: Record<string, { expected: number; actual: number }> = {};
  for (const key of catKeys) {
    byCategory[key] = {
      expected: expectedByCat[key] || 0,
      actual: actualByCat[key] || 0
    };
  }

  return {
    totalInDB: dbRecords?.length || 0,
    expectedTotal: SIH_PROBLEM_STATEMENTS.length,
    byDepartment,
    byCategory,
    missingPSNumbers,
    duplicatePSNumbers,
    allDraft,
    details: (dbRecords || []).map(r => ({
      sihPsNumber: r.sih_ps_number || "N/A",
      title: r.title,
      department: r.department,
      category: r.category,
      status: r.status
    }))
  };
}