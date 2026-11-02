/**
 * Create the Team Project Submission Form in the database
 * Run with: node scripts/create-submission-form.js
 */
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function createForm() {
  try {
    // Find the first active evaluation round
    console.log('Looking for active evaluation round...');
    const { data: rounds, error: roundsError } = await supabase
      .from('evaluation_rounds')
      .select('id, title, sequence_order, status')
      .order('sequence_order', { ascending: true })
      .limit(1);

    if (roundsError || !rounds || rounds.length === 0) {
      console.error('No evaluation rounds found. Please create one first.');
      process.exit(1);
    }

    const round = rounds[0];
    console.log(`Found round: ${round.title} (${round.id})`);

    // Check if form already exists for this round
    const { data: existingForms } = await supabase
      .from('submission_forms')
      .select('id, title')
      .eq('round_id', round.id);

    if (existingForms && existingForms.length > 0) {
      console.log(`Form already exists for this round: ${existingForms[0].title} (${existingForms[0].id})`);
      console.log('Use the existing form instead.');
      process.exit(0);
    }

    // Create the submission form
    console.log('Creating submission form...');
    const { data: form, error: formError } = await supabase
      .from('submission_forms')
      .insert([
        {
          title: 'Team Project Submission Form',
          description:
            'Submit your project deliverables including presentation, technical documentation, prototype evidence, and final declaration.',
          round_id: round.id,
          form_status: 'published',
          submission_state: 'open',
          timezone: 'Asia/Kolkata',
          allow_early_view: false,
          allow_draft_before_open: false,
          allow_edit_after_submit: true,
          allow_resubmission: true,
          resubmission_policy: 'until_deadline',
          auto_lock_at_deadline: true,
          allow_member_submit: true,
          max_marks: 100,
          created_by: '00000000-0000-0000-0000-000000000000',
          updated_by: '00000000-0000-0000-0000-000000000000',
        },
      ])
      .select()
      .single();

    if (formError) {
      console.error('Failed to create form:', formError);
      process.exit(1);
    }

    console.log(`Created form: ${form.title} (${form.id})`);

    // Create sections and questions
    const sections = [
      {
        title: 'Project Identification',
        description: 'Basic project information',
        sort_order: 1,
        questions: [
          {
            title: 'Project Title',
            description: 'The official title of your project',
            question_type: 'short_answer',
            is_required: true,
          },
          {
            title: 'Selected Domain / Track',
            description: 'Select the competition track your project belongs to',
            question_type: 'dropdown',
            is_required: true,
            options: ['Artificial Intelligence', 'Web Development', 'Mobile Development', 'Data Science', 'Cybersecurity', 'Blockchain', 'IoT', 'Other'],
          },
          {
            title: 'Team Name',
            description: 'Your team name as registered',
            question_type: 'short_answer',
            is_required: true,
          },
          {
            title: 'Team ID',
            description: 'Your team identifier as registered',
            question_type: 'short_answer',
            is_required: true,
          },
          {
            title: 'Team Leader Name',
            description: 'Name of the team leader',
            question_type: 'short_answer',
            is_required: true,
          },
        ],
      },
      {
        title: 'Presentation Deliverable',
        description: 'Presentation and documentation links',
        sort_order: 2,
        questions: [
          {
            title: 'Canva PPT / Presentation Link',
            description: 'Link to your presentation slides',
            question_type: 'url',
            is_required: true,
          },
          {
            title: 'GitHub Repository URL',
            description: 'Link to your GitHub repository',
            question_type: 'url',
            is_required: false,
          },
          {
            title: 'Additional Reference / Google Drive Folder',
            description: 'Link to any additional reference materials',
            question_type: 'url',
            is_required: false,
          },
        ],
      },
      {
        title: 'Prototype & Implementation Evidence',
        description: 'Proof of your working prototype',
        sort_order: 3,
        questions: [
          {
            title: 'Live Deployment URL',
            description: 'Link to your live deployed application',
            question_type: 'url',
            is_required: false,
          },
          {
            title: 'Demo Video Link',
            description: 'Link to your demo video',
            question_type: 'url',
            is_required: false,
          },
          {
            title: 'Upload Project Screenshots',
            description: 'Upload screenshots of your project',
            question_type: 'file_upload',
            is_required: false,
            max_attachments: 5,
            allowed_file_types: ['jpg', 'jpeg', 'png', 'webp'],
          },
        ],
      },
      {
        title: 'Final Declaration',
        description: 'Declaration of originality',
        sort_order: 4,
        questions: [
          {
            title: 'Final Declaration',
            description: 'We confirm that the submitted information and deliverables are accurate, the project work is our team\'s own, and all external resources, libraries, datasets, and third-party tools have been appropriately acknowledged.',
            question_type: 'checkbox',
            is_required: true,
            options: ['I confirm that the submitted information and deliverables are accurate, the project work is our team\'s own, and all external resources, libraries, datasets, and third-party tools have been appropriately acknowledged.'],
          },
        ],
      },
    ];

    for (const sectionData of sections) {
      const { data: section, error: sectionError } = await supabase
        .from('form_sections')
        .insert([
          {
            form_id: form.id,
            title: sectionData.title,
            description: sectionData.description,
            sort_order: sectionData.sort_order,
            is_required: sectionData.is_required,
          },
        ])
        .select()
        .single();

      if (sectionError) {
        console.error(`Failed to create section "${sectionData.title}":`, sectionError);
        continue;
      }

      console.log(`  Created section: ${section.title} (${section.id})`);

      for (const [qIndex, questionData] of sectionData.questions.entries()) {
        const questionInsert = {
          section_id: section.id,
          title: questionData.title,
          description: questionData.description,
          question_type: questionData.question_type,
          is_required: questionData.is_required,
          sort_order: qIndex + 1,
          max_attachments: questionData.question_type === 'file_upload' ? questionData.max_attachments : 1,
          allowed_file_types: questionData.question_type === 'file_upload' ? questionData.allowed_file_types : null,
        };

        const { data: question, error: questionError } = await supabase
          .from('form_questions')
          .insert([questionInsert])
          .select()
          .single();

        if (questionError) {
          console.error(`    Failed to create question "${questionData.title}":`, questionError);
          continue;
        }

        // Create options for dropdown questions
        if (questionData.options) {
          const optionsToInsert = questionData.options.map((opt, idx) => ({
            question_id: question.id,
            option_text: opt,
            option_value: opt.toLowerCase().replace(/\s+/g, '_'),
            sort_order: idx + 1,
          }));

          const { error: optsError } = await supabase
            .from('form_question_options')
            .insert(optionsToInsert);

          if (optsError) {
            console.error(`      Failed to create options for question "${questionData.title}":`, optsError);
          }
        }

        console.log(`    Created question: ${questionData.title} (${question.id})`);
      }
    }

    console.log('\n=== Form creation complete! ===');
    console.log(`Form ID: ${form.id}`);
    console.log(`Form Title: ${form.title}`);
    console.log(`Associated Round: ${round.title}`);
    console.log('\nYou can now view this form at /admin/submission-forms');
    console.log('And submit to it at /team/submission');
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

createForm();