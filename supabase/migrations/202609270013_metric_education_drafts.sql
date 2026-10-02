update public.metric_definitions
set display_names = case metric_key
  when 'blood_glucose' then '{"en":"Blood glucose","fr":"Glycémie","ar":"سكر الدم"}'::jsonb
  when 'inr' then '{"en":"INR","fr":"INR","ar":"النسبة المعيارية الدولية (INR)"}'::jsonb
  else display_names
end
where metric_key in ('blood_glucose', 'inr');

create policy "metric_editors_claim_seed_drafts"
  on public.metric_content_versions for update to authenticated
  using (
    (select public.has_ihssan_permission('metrics.edit'))
    and authored_by is null
    and status = 'draft'
  )
  with check (
    (select public.has_ihssan_permission('metrics.edit'))
    and authored_by = (select auth.uid())
    and status = 'draft'
  );

with localized_content(metric_key, locale, content, evidence_sources) as (
  values
    (
      'blood_glucose', 'en',
      '{"title":"Understanding blood glucose","summary":"A blood glucose result measures the amount of glucose in a blood sample at a particular time.","short_explanation":"Glucose is a sugar that the body uses for energy. A result is interpreted in context, including when the sample was taken and whether you had eaten.","detailed_explanation":"Blood glucose can be measured while fasting, after a meal, or at another time. These situations are not directly interchangeable. Your clinician may interpret the result together with symptoms, medicines, pregnancy status, other tests, and your personal care plan. This record is for tracking the value shown by your laboratory or meter; it does not diagnose diabetes or replace medical advice.","how_to_read":"Check the unit and the sample timing on the original report. Use the same unit shown there, and add the measurement date. If timing or context is important, include it in your notes to your care team.","entry_guidance":"Enter the result exactly as reported. Do not convert units unless your clinician or the device instructions tell you to.","safety_note":"Do not start, stop, or change medicine based only on this screen. Contact a healthcare professional if you are unsure how to interpret a result; seek urgent care for severe or rapidly worsening symptoms."}'::jsonb,
      '[{"title":"WHO: Diabetes","url":"https://www.who.int/news-room/fact-sheets/detail/diabetes"},{"title":"MedlinePlus: Blood Glucose Test","url":"https://medlineplus.gov/lab-tests/blood-glucose-test/"}]'::jsonb
    ),
    (
      'blood_glucose', 'fr',
      '{"title":"Comprendre la glycémie","summary":"Un résultat de glycémie mesure la quantité de glucose dans un échantillon de sang à un moment donné.","short_explanation":"Le glucose est un sucre que le corps utilise comme source d’énergie. Le résultat s’interprète selon le contexte, notamment l’heure du prélèvement et le fait d’avoir mangé ou non.","detailed_explanation":"La glycémie peut être mesurée à jeun, après un repas ou à un autre moment. Ces situations ne sont pas directement comparables. Un professionnel de santé peut interpréter le résultat avec les symptômes, les médicaments, la grossesse, d’autres examens et votre plan de soins. Cet enregistrement sert à suivre la valeur indiquée par le laboratoire ou le lecteur; il ne pose pas un diagnostic et ne remplace pas un avis médical.","how_to_read":"Vérifiez l’unité et le moment du prélèvement sur le compte rendu. Utilisez l’unité indiquée et la date de la mesure. Si le contexte compte, signalez-le à votre équipe soignante.","entry_guidance":"Saisissez le résultat tel qu’il est indiqué. Ne convertissez pas les unités sauf indication d’un professionnel ou de la notice de l’appareil.","safety_note":"Ne commencez, n’arrêtez et ne modifiez aucun médicament sur la seule base de cet écran. Demandez conseil à un professionnel si vous avez un doute; consultez en urgence en cas de symptômes graves ou qui s’aggravent rapidement."}'::jsonb,
      '[{"title":"OMS : Diabète","url":"https://www.who.int/fr/news-room/fact-sheets/detail/diabetes"},{"title":"MedlinePlus : Dosage de la glycémie","url":"https://medlineplus.gov/lab-tests/blood-glucose-test/"}]'::jsonb
    ),
    (
      'blood_glucose', 'ar',
      '{"title":"فهم نتيجة سكر الدم","summary":"تقيس نتيجة سكر الدم كمية الغلوكوز في عينة الدم في وقت محدد.","short_explanation":"الغلوكوز نوع من السكر يستخدمه الجسم للحصول على الطاقة. تُفسَّر النتيجة بحسب السياق، بما في ذلك وقت أخذ العينة وما إذا كنت قد تناولت الطعام.","detailed_explanation":"يمكن قياس سكر الدم أثناء الصيام أو بعد وجبة أو في وقت آخر، وهذه الحالات ليست قابلة للمقارنة مباشرة. قد يفسر الطبيب النتيجة مع الأعراض والأدوية والحمل والفحوص الأخرى وخطة الرعاية الخاصة بك. يُستخدم هذا السجل لمتابعة القيمة الواردة من المختبر أو الجهاز، ولا يشخّص مرض السكري ولا يغني عن المشورة الطبية.","how_to_read":"تحقق من الوحدة وتوقيت العينة في التقرير الأصلي. أدخل الوحدة نفسها وتاريخ القياس. إذا كان توقيت الفحص أو سياقه مهمًا، فأخبر فريق الرعاية.","entry_guidance":"أدخل النتيجة كما وردت في التقرير. لا تحوّل الوحدات إلا إذا أوصى الطبيب أو دليل الجهاز بذلك.","safety_note":"لا تبدأ دواءً أو توقفه أو تغيّر جرعته اعتمادًا على هذه الشاشة وحدها. تواصل مع مختص صحي إذا لم تكن متأكدًا من معنى النتيجة، واطلب رعاية عاجلة عند ظهور أعراض شديدة أو تتفاقم بسرعة."}'::jsonb,
      '[{"title":"منظمة الصحة العالمية: السكري","url":"https://www.who.int/news-room/fact-sheets/detail/diabetes"},{"title":"MedlinePlus: فحص سكر الدم","url":"https://medlineplus.gov/lab-tests/blood-glucose-test/"}]'::jsonb
    ),
    (
      'inr', 'en',
      '{"title":"Understanding INR","summary":"INR is a standardized way to report how long blood takes to clot in a laboratory test.","short_explanation":"INR is commonly monitored for people taking certain anticoagulant medicines. The intended target is individual and must come from the prescribing clinician.","detailed_explanation":"An INR result is interpreted in relation to the reason for treatment, the prescribed medicine and dose, recent changes, other medicines, illness, and the care plan. There is no single target that is right for everyone. This record helps you keep a history of reported results; it does not recommend a dose or replace your anticoagulation service.","how_to_read":"Enter the INR value as shown on the laboratory report and use the test date. Follow the follow-up instructions given by your clinician or anticoagulation service.","entry_guidance":"INR is recorded without a unit in this app. Copy the result exactly as reported and do not alter your medicine based on the chart.","safety_note":"Do not change or skip anticoagulant doses based only on this screen. Contact your care team for advice about a result or dose. Seek urgent care for serious bleeding, a significant injury, or other severe symptoms."}'::jsonb,
      '[{"title":"NHS: Warfarin","url":"https://www.nhs.uk/medicines/warfarin/"},{"title":"MedlinePlus: Prothrombin Time Test and INR","url":"https://medlineplus.gov/lab-tests/prothrombin-time-test-and-inr-ptinr/"}]'::jsonb
    ),
    (
      'inr', 'fr',
      '{"title":"Comprendre l’INR","summary":"L’INR est une méthode standardisée pour indiquer le temps de coagulation mesuré en laboratoire.","short_explanation":"L’INR est souvent suivi chez les personnes prenant certains anticoagulants. La cible souhaitée est individuelle et doit être définie par le professionnel prescripteur.","detailed_explanation":"Le résultat d’INR s’interprète selon la raison du traitement, le médicament et la dose prescrits, les changements récents, les autres médicaments, les maladies et le plan de soins. Il n’existe pas de cible unique adaptée à tout le monde. Cet historique conserve les résultats rapportés; il ne recommande pas de dose et ne remplace pas le suivi par votre équipe d’anticoagulation.","how_to_read":"Saisissez la valeur INR telle qu’elle figure sur le compte rendu et indiquez la date du test. Suivez les consignes de votre professionnel ou de votre service d’anticoagulation.","entry_guidance":"L’INR est enregistré sans unité dans cette application. Recopiez exactement le résultat et ne modifiez pas votre traitement selon le graphique.","safety_note":"Ne modifiez pas et ne sautez pas une dose d’anticoagulant sur la seule base de cet écran. Demandez conseil à votre équipe soignante. Consultez en urgence en cas de saignement important, de blessure grave ou d’autres symptômes sévères."}'::jsonb,
      '[{"title":"NHS : Warfarine","url":"https://www.nhs.uk/medicines/warfarin/"},{"title":"MedlinePlus : Temps de prothrombine et INR","url":"https://medlineplus.gov/lab-tests/prothrombin-time-test-and-inr-ptinr/"}]'::jsonb
    ),
    (
      'inr', 'ar',
      '{"title":"فهم نتيجة INR","summary":"النسبة المعيارية الدولية (INR) طريقة موحدة لعرض زمن تخثر الدم في فحص مخبري.","short_explanation":"تُتابَع نتيجة INR غالبًا لدى من يتناولون بعض مضادات التخثر. والهدف العلاجي يختلف من شخص إلى آخر ويحدده الطبيب المعالج.","detailed_explanation":"تُفسَّر نتيجة INR وفق سبب العلاج والدواء والجرعة الموصوفة والتغييرات الحديثة والأدوية الأخرى والحالة الصحية وخطة الرعاية. لا يوجد هدف واحد مناسب للجميع. يساعد هذا السجل على حفظ النتائج كما وردت، لكنه لا يوصي بجرعة ولا يحل محل متابعة فريق علاج مضادات التخثر.","how_to_read":"أدخل قيمة INR كما تظهر في تقرير المختبر مع تاريخ الفحص. اتبع تعليمات الطبيب أو فريق متابعة مضادات التخثر.","entry_guidance":"تُسجل INR في هذا التطبيق دون وحدة. انقل النتيجة كما هي ولا تغيّر دواءك اعتمادًا على الرسم البياني.","safety_note":"لا تغيّر جرعة مضاد التخثر أو تتجاوزها اعتمادًا على هذه الشاشة وحدها. تواصل مع فريق الرعاية للحصول على المشورة. اطلب رعاية عاجلة عند حدوث نزيف شديد أو إصابة مهمة أو أعراض خطيرة أخرى."}'::jsonb,
      '[{"title":"NHS: Warfarin","url":"https://www.nhs.uk/medicines/warfarin/"},{"title":"MedlinePlus: فحص زمن البروثرومبين وINR","url":"https://medlineplus.gov/lab-tests/prothrombin-time-test-and-inr-ptinr/"}]'::jsonb
    )
)
insert into public.metric_content_versions (
  metric_definition_id,
  locale,
  content,
  reference_ranges,
  evidence_sources,
  status,
  authored_by
)
select definition.id,
       localized_content.locale,
       localized_content.content,
       null,
       localized_content.evidence_sources,
       'draft',
       null
from localized_content
join public.metric_definitions as definition
  on definition.metric_key = localized_content.metric_key
 and definition.is_active
where not exists (
  select 1
  from public.metric_content_versions as existing
  where existing.metric_definition_id = definition.id
    and existing.locale = localized_content.locale
    and existing.status = 'draft'
);