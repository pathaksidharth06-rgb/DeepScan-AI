import jsPDF from 'jspdf';
import type { SonarScan } from '../types/sonar';

const BACKEND_URL = 'https://deepscan-ai-tyvx.onrender.com';

async function resolveImageAsBase64(
  imageUrl: string
): Promise<string | null> {

  if (!imageUrl) return null;

  // Already base64
  if (imageUrl.startsWith('data:image/')) {
    return imageUrl;
  }

  let url = imageUrl;

  // Relative Render output URL
  if (url.startsWith('/outputs')) {
    url = `${BACKEND_URL}${url}`;
  }

  // Old localhost URL
  if (url.startsWith('http://localhost:8000')) {
    url = url.replace(
      'http://localhost:8000',
      BACKEND_URL
    );
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        'Image request failed:',
        response.status,
        url
      );
      return null;
    }

    const blob = await response.blob();

    return new Promise((resolve) => {

      const reader = new FileReader();

      reader.onloadend = () => {
        resolve(reader.result as string);
      };

      reader.onerror = () => {
        resolve(null);
      };

      reader.readAsDataURL(blob);
    });

  } catch (err) {

    console.warn(
      'Failed to load image for PDF embedding:',
      err
    );

    return null;
  }
}


export async function generateSurveyPdfReport(
  scan: SonarScan
): Promise<void> {

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');

  doc.text(
    'DEEPSCAN AI — SONAR INTELLIGENCE REPORT',
    14,
    14
  );

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);

  doc.text(
    'AUTONOMOUS UNDERWATER THREAT & DEBRIS CLASSIFICATION',
    14,
    21
  );

  const reportId =
    `REP-${scan.id.slice(0, 8).toUpperCase()}-${Date.now()
      .toString()
      .slice(-4)}`;

  doc.setFontSize(8);

  doc.text(
    `Report ID: ${reportId}`,
    pageWidth - 14,
    21,
    { align: 'right' }
  );


  // Metadata Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);

  doc.roundedRect(
    14,
    33,
    pageWidth - 28,
    26,
    2,
    2,
    'FD'
  );

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  let displayFilename = scan.filename;

  if (displayFilename.length > 30) {
    displayFilename =
      displayFilename.substring(0, 18) +
      '...' +
      displayFilename.slice(-10);
  }

  // Left Column
  doc.text(
    `File: ${displayFilename}`,
    18,
    40,
    { maxWidth: 90 }
  );

  doc.text(
    `Resolution: ${scan.resolution.width} × ${scan.resolution.height} px`,
    18,
    46
  );

  doc.text(
    `File Size: ${scan.fileSizeMB} MB`,
    18,
    52
  );

  // Right Column
  doc.text(
    `Model: ${scan.modelVersion}`,
    115,
    40,
    { maxWidth: 75 }
  );

  doc.text(
    `Inference Time: ${scan.processingTimeMs} ms`,
    115,
    46
  );

  doc.text(
    `Timestamp: ${scan.processedAt}`,
    115,
    52,
    { maxWidth: 75 }
  );


  // Sonar Image Evidence Section
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text(
    '1. Acoustic Sonar Visual Evidence (Annotated Detections)',
    14,
    68
  );


  // Prefer annotated image
  const rawImage =
    scan.annotatedImageUrl ||
    scan.imageUrl;

  const base64Image =
    rawImage
      ? await resolveImageAsBase64(rawImage)
      : null;


  if (base64Image) {

    try {

      // Add image
      doc.addImage(
        base64Image,
        'JPEG',
        14,
        72,
        100,
        75
      );

    } catch (err) {

      console.warn(
        'Could not embed JPEG, trying PNG',
        err
      );

      try {

        doc.addImage(
          base64Image,
          'PNG',
          14,
          72,
          100,
          75
        );

      } catch {

        doc.setFontSize(9);

        doc.text(
          '[Annotated sonar imagery attached in appendix]',
          18,
          80
        );
      }
    }

  } else {

    doc.setFillColor(241, 245, 249);

    doc.roundedRect(
      14,
      72,
      100,
      75,
      2,
      2,
      'FD'
    );

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.text(
      '[Sonar visual evidence not available on record]',
      20,
      110
    );
  }


  // Summary box
  doc.setFillColor(241, 245, 249);

  doc.roundedRect(
    120,
    72,
    pageWidth - 134,
    75,
    2,
    2,
    'FD'
  );

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  doc.text(
    'Survey Summary',
    126,
    79
  );

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(
    `Total Contacts: ${scan.detections.length}`,
    126,
    85
  );

  const highPriority =
    scan.detections.filter(
      (d) => d.priorityScore >= 70
    ).length;

  doc.text(
    `High Priority Threats: ${highPriority}`,
    126,
    91
  );

  doc.text(
    `Verified by Operator: ${
      scan.detections.filter(
        (d) => d.verificationStatus === 'verified'
      ).length
    }`,
    126,
    97
  );


  // Sonar Quality
  const sq = scan.sonarQuality;
  const ea = scan.evidenceAssessment;

  const speckleLvl =
    sq?.speckleNoise?.speckleLevel
      ? sq.speckleNoise.speckleLevel
      : 'UNAVAILABLE';

  const qualRating =
    sq?.resolutionQuality?.qualityRating
      ? sq.resolutionQuality.qualityRating
      : 'UNAVAILABLE';

  const dropoutSev =
    sq?.motionDropout?.artifactSeverity
      ? sq.motionDropout.artifactSeverity
      : 'UNAVAILABLE';

  const evText =
    ea?.evidenceScore !== undefined &&
    ea?.evidenceScore !== null
      ? `${ea.evidenceScore}/100 (${ea.reliability || 'N/A'})`
      : 'UNAVAILABLE';

  doc.text(
    `Speckle Noise: ${speckleLvl}`,
    126,
    103
  );

  doc.text(
    `2D Quality: ${qualRating}`,
    126,
    109
  );

  doc.text(
    `Motion Dropout: ${dropoutSev}`,
    126,
    115
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text(
    `AI Evidence: ${evText}`,
    126,
    122
  );


  // Detections Table
  let y = 156;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text(
    '2. Classified Contacts & Intelligence Insights',
    14,
    y
  );

  y += 6;

  // Table Header
  doc.setFillColor(30, 41, 59);

  doc.rect(
    14,
    y,
    pageWidth - 28,
    8,
    'F'
  );

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');

  doc.text('#', 17, y + 5.5);
  doc.text('Object Class', 25, y + 5.5);
  doc.text('Confidence', 65, y + 5.5);
  doc.text('Priority Score', 92, y + 5.5);
  doc.text('Eco / Threat Impact', 122, y + 5.5);
  doc.text('Status', 165, y + 5.5);

  y += 8;


  if (scan.detections.length === 0) {

    doc.setFillColor(250, 250, 250);

    doc.rect(
      14,
      y,
      pageWidth - 28,
      10,
      'F'
    );

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    doc.text(
      'No targets detected in this sonar frame (Clean Seabed).',
      25,
      y + 6.5
    );

    y += 10;

  } else {

    scan.detections.forEach(
      (det, idx) => {

        doc.setFillColor(
          idx % 2 === 0 ? 255 : 248,
          idx % 2 === 0 ? 255 : 250,
          idx % 2 === 0 ? 255 : 252
        );

        doc.rect(
          14,
          y,
          pageWidth - 28,
          12,
          'F'
        );

        doc.setDrawColor(
          226,
          232,
          240
        );

        doc.line(
          14,
          y + 12,
          pageWidth - 14,
          y + 12
        );

        doc.setFontSize(8);
        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setTextColor(
          30,
          41,
          59
        );

        doc.text(
          `${idx + 1}`,
          17,
          y + 7
        );

        doc.setFont(
          'helvetica',
          'bold'
        );

        doc.text(
          det.className,
          25,
          y + 5.5,
          { maxWidth: 38 }
        );

        doc.setFont(
          'helvetica',
          'normal'
        );

        doc.setFontSize(7);
        doc.setTextColor(
          100,
          116,
          139
        );

        doc.text(
          det.category,
          25,
          y + 9.5,
          { maxWidth: 38 }
        );

        doc.setFontSize(8);
        doc.setTextColor(
          30,
          41,
          59
        );

        doc.text(
          `${Math.round(
            det.confidence * 100
          )}%`,
          65,
          y + 7
        );

        doc.text(
          `${det.priorityScore}/100 (${det.priorityLevel})`,
          92,
          y + 7
        );

        doc.text(
          det.ecoImpact,
          122,
          y + 7,
          { maxWidth: 40 }
        );

        const statusText =
          det.verificationStatus.toUpperCase();

        doc.setFont(
          'helvetica',
          'bold'
        );

        if (
          det.verificationStatus ===
          'verified'
        ) {

          doc.setTextColor(
            180,
            83,
            9
          );

        } else if (
          det.verificationStatus ===
          'rejected'
        ) {

          doc.setTextColor(
            120,
            53,
            15
          );

        } else {

          doc.setTextColor(
            100,
            116,
            139
          );
        }

        doc.text(
          statusText,
          165,
          y + 7
        );

        y += 12;
      }
    );
  }


  // Recommended Actions
  y += 6;

  doc.setFillColor(
    254,
    243,
    199
  );

  doc.setDrawColor(
    252,
    211,
    77
  );

  doc.roundedRect(
    14,
    y,
    pageWidth - 28,
    22,
    2,
    2,
    'FD'
  );

  doc.setFontSize(8.5);
  doc.setFont(
    'helvetica',
    'bold'
  );

  doc.setTextColor(
    146,
    64,
    14
  );

  doc.text(
    'Operational Action Directive:',
    18,
    y + 6
  );

  doc.setFontSize(8);
  doc.setFont(
    'helvetica',
    'normal'
  );

  doc.setTextColor(
    180,
    83,
    9
  );

  const primaryDet =
    scan.detections[0];

  const directive = primaryDet
    ? `Target [${primaryDet.className}]: ${primaryDet.actionRecommended}. Coordinate subsea intervention team and catalog contact in hydrographic repository.`
    : 'No critical threats detected. Continue standard survey transect.';

  doc.text(
    directive,
    18,
    y + 12,
    { maxWidth: pageWidth - 36 }
  );


  // Footer
  const footerY = 255;

  doc.setDrawColor(
    203,
    213,
    225
  );

  doc.line(
    14,
    footerY,
    pageWidth - 14,
    footerY
  );

  doc.setFontSize(7.5);

  doc.setFont(
    'helvetica',
    'italic'
  );

  doc.setTextColor(
    148,
    163,
    184
  );

  doc.text(
    'Certified by DeepScan AI Maritime Autonomous Decision Support Engine v2.0',
    14,
    footerY + 6
  );

  doc.text(
    'Hydrographic Survey Officer: __________________________   Date: ________________',
    pageWidth - 14,
    footerY + 6,
    {
      align: 'right',
    }
  );


  // Save PDF
  doc.save(
    `DeepScan_Report_${scan.filename.replace(
      /\.[^/.]+$/,
      ''
    )}_${Date.now()}.pdf`
  );
}
