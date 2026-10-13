package br.com.metaro.portal.util.picture;

import br.com.metaro.portal.modules.general.post.entities.Post;
import br.com.metaro.portal.modules.general.post.repositories.PostRepository;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStep;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepType;
import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;

@Service
public class PictureService {
    private static final int THUMB_MAX_SIZE = 240;
    private static DateTimeFormatter SERVER_FILE_TIMESTAMP_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmSSS");
    private static char[] RANDOM_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toCharArray();
    private static SecureRandom RANDOM = new SecureRandom();

    @Autowired
    private PictureRepository pictureRepository;
    @Autowired
    private PostRepository postRepository;
    @Value("${app.server.image-path}")
    private String serverPath;

    @Transactional
    public List<Picture> savePostImages(List<MultipartFile> files, Post post) throws IOException {
        List<Picture> archives = new ArrayList<>();
        PictureType type = PictureType.POST;

        /// salva arquivo no servidor
        for (MultipartFile file : files) {
            String fileName = UUID.randomUUID().toString().replace("-","")+ "_" + type.name() + ".jpg";
            Path filePath = Paths.get(serverPath, fileName);
            saveCompressedImage(file, filePath);

            Picture archive = new Picture();
            archive.setName(fileName);
            archive.setPath(filePath.toString());
            archive.setType(type);

            if (post != null) archive.setPost(post);

            archives.add(archive);
        }

        /// salva entidade no banco
        return pictureRepository.saveAll(archives);
    }

    @Transactional
    public List<Picture> saveProfileImages(List<MultipartFile> files) throws IOException {
        List<Picture> archives = new ArrayList<>();
        PictureType type = PictureType.PROFILE;

        /// salva arquivo no servidor
        for (MultipartFile file : files) {
            String fileName = UUID.randomUUID().toString().replace("-","")+ "_" + type.name() + ".jpg";
            Path filePath = Paths.get(serverPath, fileName);
            saveCompressedImage(file, filePath);

            Picture archive = new Picture();
            archive.setName(fileName);
            archive.setPath(filePath.toString());
            archive.setType(type);
            archives.add(archive);
        }

        /// salva entidade no banco
        return pictureRepository.saveAll(archives);
    }

    @Transactional
    public List<Picture> saveStepFlowImages(List<MultipartFile> files, OrderStep step) throws IOException {
        List<Picture> archives = new ArrayList<>();
        PictureType type = PictureType.STEP_FLOW;

        String prefix = "IMAGEM";
        if (step.getStep().equals(StepType.FINAL_ASSEMBLY)) prefix = "EVIDENCIA";
        if (step.getStep().equals(StepType.SHIPPING)) prefix = "CANHOTO";

        /// salva arquivo no servidor
        for (MultipartFile file : files) {
            String name = buildPictureName(prefix, file);
            Path filePath = reserveUniqueServerPath(type);

            try {
                saveCompressedImage(file, filePath);
            } catch (IOException | RuntimeException exception) {
                Files.deleteIfExists(filePath);
                throw exception;
            }

            Picture archive = new Picture();
            archive.setName(name);
            archive.setPath(filePath.toString());
            archive.setType(type);
            archive.setOrderStep(step);

            archives.add(archive);
        }

        /// salva entidade no banco
        return pictureRepository.saveAll(archives);
    }

    @Transactional
    public List<Picture> saveChecklistImages(List<MultipartFile> files) throws IOException {
        List<Picture> pictures = new ArrayList<>();
        PictureType type = PictureType.CHECKLIST;

        for (MultipartFile file : files) {
            String name = buildPictureName("EVIDENCIA", file);
            Path filePath = reserveUniqueServerPath(type);

            try {
                saveCompressedImage(file, filePath);
            } catch (IOException | RuntimeException exception) {
                Files.deleteIfExists(filePath);
                throw exception;
            }

            Picture picture = new Picture();
            picture.setName(name);
            picture.setPath(filePath.toString());
            picture.setType(type);
            pictures.add(picture);
        }

        return pictureRepository.saveAll(pictures);
    }

    private String buildPictureName(String prefix, MultipartFile file) {
        String originalName = StringUtils.getFilename(
                StringUtils.cleanPath(StringUtils.hasText(file.getOriginalFilename())
                        ? file.getOriginalFilename()
                        : "imagem")
        );
        int extensionIndex = originalName.lastIndexOf('.');

        if (extensionIndex > 0) {
            originalName = originalName.substring(0, extensionIndex);
        }

        return prefix + "_" + originalName + ".jpg";
    }

    private Path reserveUniqueServerPath(PictureType type) throws IOException {
        Path imageDirectory = Paths.get(serverPath);
        Files.createDirectories(imageDirectory);

        while (true) {
            Path filePath = imageDirectory.resolve(buildServerFileName(type));

            try {
                return Files.createFile(filePath);
            } catch (FileAlreadyExistsException ignored) {
                // ignorado
            }
        }
    }

    private String buildServerFileName(PictureType type) {
        String timestamp = LocalDateTime.now().format(SERVER_FILE_TIMESTAMP_FORMATTER);
        StringBuilder randomSuffix = new StringBuilder(3);

        for (int index = 0; index < 3; index++) {
            randomSuffix.append(RANDOM_CHARACTERS[RANDOM.nextInt(RANDOM_CHARACTERS.length)]);
        }

        return type.name() + timestamp + randomSuffix + ".jpg";
    }

    @Transactional
    public void delete(Long id) throws IOException {
        PictureDeleteProjection picture = pictureRepository.findDeleteProjectionById(id)
                .orElseThrow(RuntimeException::new);

        Files.deleteIfExists(Paths.get(picture.getPath()));
        if (StringUtils.hasText(picture.getThumb())) {
            Files.deleteIfExists(Paths.get(picture.getThumb()));
        }
        pictureRepository.deleteDirectlyById(id);
    }

    @Transactional
    public Picture replace(Long id, MultipartFile file) throws IOException {
        Picture picture = pictureRepository.findById(id).orElseThrow(RuntimeException::new);
        saveCompressedImage(file, Paths.get(picture.getPath()));

        if (StringUtils.hasText(picture.getThumb())) {
            Files.deleteIfExists(Paths.get(picture.getThumb()));
            picture.setThumb(null);
        }

        return picture;
    }

    @Transactional
    public synchronized Path getOrCreateThumbnail(Long id) throws IOException {
        Picture picture = pictureRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Imagem não encontrada"));

        Path thumbnailPath = StringUtils.hasText(picture.getThumb())
                ? Paths.get(picture.getThumb())
                : buildThumbnailPath(picture);

        if (!Files.isRegularFile(thumbnailPath)) {
            createThumbnail(Paths.get(picture.getPath()), thumbnailPath);
        }

        if (!thumbnailPath.toString().equals(picture.getThumb())) {
            picture.setThumb(thumbnailPath.toString());
            pictureRepository.save(picture);
        }

        return thumbnailPath;
    }

    private Path buildThumbnailPath(Picture picture) throws IOException {
        Path originalPath = Paths.get(picture.getPath());
        Path imageDirectory = originalPath.getParent();

        if (imageDirectory == null) {
            throw new IOException("Caminho da imagem não possui diretório");
        }

        Path thumbnailDirectory = imageDirectory.resolveSibling("thumbs");
        Files.createDirectories(thumbnailDirectory);
        return thumbnailDirectory.resolve(originalPath.getFileName());
    }

    private void createThumbnail(Path source, Path destination) throws IOException {
        BufferedImage original = ImageIO.read(source.toFile());

        if (original == null) {
            throw new IOException("Arquivo não é uma imagem válida");
        }

        double scale = Math.min(1d, (double) THUMB_MAX_SIZE / Math.max(original.getWidth(), original.getHeight()));
        int width = Math.max(1, (int) Math.round(original.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(original.getHeight() * scale));
        BufferedImage thumbnail = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = thumbnail.createGraphics();

        graphics.setColor(Color.WHITE);
        graphics.fillRect(0, 0, width, height);
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(original, 0, 0, width, height, null);
        graphics.dispose();

        Files.createDirectories(destination.getParent());
        writeJpeg(thumbnail, destination, 0.65f);
    }

    @Transactional
    public void deleteCheckingReferences(Long id, Long excludingUserId) throws IOException {
        boolean referenced = pictureRepository
                .existsUserReference(id, excludingUserId) || pictureRepository.existsEventReference(id);

        if (referenced) return;
        delete(id);
    }

    private void saveCompressedImage(MultipartFile file, Path destination) throws IOException {
        BufferedImage original = ImageIO.read(file.getInputStream());

        if (original == null) throw new IOException("Arquivo não é uma imagem válida");

        int orientation = getOrientation(file);
        original = correctOrientation(original, orientation);
        BufferedImage imageToSave = original;

        final int maxWidth = 1920;

        if (original.getWidth() > maxWidth) {
            int newWidth;
            int newHeight;

            if (original.getWidth() > original.getHeight()) {
                newWidth = maxWidth;
                newHeight = (original.getHeight() * newWidth) / original.getWidth();
            } else {
                newHeight = maxWidth;
                newWidth = (original.getWidth() * newHeight) / original.getHeight();
            }

            BufferedImage resized = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = resized.createGraphics();

            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(original, 0, 0, newWidth, newHeight, null);
            g.dispose();

            imageToSave = resized;
        }

        if (imageToSave.getColorModel().hasAlpha()) {
            imageToSave = convertToRgb(imageToSave);
        }

        writeJpeg(imageToSave, destination, 0.75f);
    }

    private void writeJpeg(BufferedImage image, Path destination, float quality) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");

        if (!writers.hasNext()) {
            throw new IllegalStateException("Nenhum ImageWriter JPEG encontrado. Verifique a dependência.");
        }

        ImageWriter writer = writers.next();

        try (ImageOutputStream ios = ImageIO.createImageOutputStream(destination.toFile())) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();

            if (param.canWriteCompressed()) {
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(quality);
            }

            writer.write(null, new IIOImage(image, null, null), param);
        } finally {
            writer.dispose();
        }
    }

    private BufferedImage convertToRgb(BufferedImage source) {
        BufferedImage rgbImage = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = rgbImage.createGraphics();

        g.setColor(Color.WHITE);
        g.fillRect(0, 0, source.getWidth(), source.getHeight());
        g.drawImage(source, 0, 0, null);
        g.dispose();

        return rgbImage;
    }

    private BufferedImage correctOrientation(BufferedImage image, int orientation) {
        AffineTransform transform = new AffineTransform();

        switch (orientation) {
            case 6: // 90° CW
                transform.translate(image.getHeight(), 0);
                transform.rotate(Math.toRadians(90));
                break;

            case 3: // 180°
                transform.translate(image.getWidth(), image.getHeight());
                transform.rotate(Math.toRadians(180));
                break;

            case 8: // 270° CW
                transform.translate(0, image.getWidth());
                transform.rotate(Math.toRadians(270));
                break;

            default:
                return image;
        }

        BufferedImage rotated = new BufferedImage(
                orientation == 6 || orientation == 8 ? image.getHeight() : image.getWidth(),
                orientation == 6 || orientation == 8 ? image.getWidth() : image.getHeight(),
                BufferedImage.TYPE_INT_RGB
        );

        Graphics2D g2d = rotated.createGraphics();
        g2d.drawImage(image, transform, null);
        g2d.dispose();

        return rotated;
    }

    private int getOrientation(MultipartFile file) {
        try (InputStream is = file.getInputStream()) {
            Metadata metadata = ImageMetadataReader.readMetadata(is);

            ExifIFD0Directory directory =
                    metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);

            if (directory != null &&
                    directory.containsTag(ExifIFD0Directory.TAG_ORIENTATION)) {

                return directory.getInt(ExifIFD0Directory.TAG_ORIENTATION);
            }

        } catch (Exception ignored) {}

        return 1;
    }
}
