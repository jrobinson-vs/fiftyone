"""
Detection evaluation.

| Copyright 2017-2021, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import logging

import eta.core.utils as etau

import fiftyone.core.media as fom
import fiftyone.core.utils as fou

from .base import (
    EvaluationConfig,
    EvaluationMethod,
    _get_eval_info,
    _record_eval_info,
    _delete_eval_info,
)
from .classification import ClassificationResults


logger = logging.getLogger(__name__)


class DetectionEvaluationConfig(EvaluationConfig):
    """Base class for configuring :class:`DetectionEvaluationMethod` instances.
    """

    pass


class DetectionEvaluationMethod(EvaluationMethod):
    """Base class for detection evaluation methods.

    Args:
        config: a :class:`DetectionEvaluationConfig`
    """

    def __init__(self, config):
        self.config = config

    def evaluate_image(self, gts, preds, eval_key=None):
        """Evaluates the ground truth and predicted objects in an image.

        Args:
            gts: a :class:`fiftyone.core.labels.Detections` instance containing
                the ground truth objects
            preds: a :class:`fiftyone.core.labels.Detections` instance
                containing the predicted objects
            eval_key (None): an evaluation key for this evaluation

        Returns:
            a list of matched ``(gt_label, pred_label)`` pairs
        """
        raise NotImplementedError("subclass must implement evaluate_image")


def list_detection_methods():
    """Lists the available evaluation methods that can be passed in the
    ``method`` argument of :meth:`evaluate_detections`.

    Returns:
         a list of methods
    """
    return ["coco"]


def evaluate_detections(
    samples,
    pred_field,
    gt_field="ground_truth",
    eval_key=None,
    classes=None,
    missing="none",
    method=None,
    config=None,
    **kwargs
):
    """Evaluates the predicted detections in the given samples with respect to
    the specified ground truth detections using the specified Intersection over
    Union (IoU) threshold to determine matches.

    By default, this methos uses COCO-style evaluation, but this can be
    configued via the ``method`` and ``config`` parameters.

    If an ``eval_key`` is provided, a number of fields are populated at the
    detection- and sample-level recording the results of the evaluation:

    The fields listed below are populated on each individual
    :class:`fiftyone.core.labels.Detection` instance; these fields tabulate the
    ID of the matching object (if any) as well as the matching IoU::

        ID:  detection.<eval_key>_id
        IoU: detection.<eval_key>_iou

    Finally, true positive (TP), false positive (FP), and false negative (FN)
    counts for the each sample are saved in the following top-level fields of
    each sample::

        TP: sample.<eval_key>_tp
        FP: sample.<eval_key>_fp
        FN: sample.<eval_key>_fn

    Args:
        samples: a :class:`fiftyone.core.collections.SampleCollection`
        pred_field: the name of the field containing the predicted
            :class:`fiftyone.core.labels.Detections` to evaluate
        gt_field ("ground_truth"): the name of the field containing the ground
            truth :class:`fiftyone.core.labels.Detections`
        eval_key (None): an evaluation key to use to refer to this evaluation
        classes (None): the list of possible classes. If not provided, the
            observed ground truth/predicted labels are used
        missing ("none"): a missing label string. Any unmatched objects are
            given this label for evaluation purposes
        method (None): an evaluation method to use from
            :meth:`list_detection_methods`
        config (None): an :class:`EvaluationConfig` specifying the evaluation
            method to use. If a ``config`` is provided, ``method`` is ignored
        **kwargs: optional keyword arguments for the :class:`EvaluationConfig`
            constructor being used

    Returns:
        a :class:`DetectionResults`
    """
    config = _parse_config(config, method, **kwargs)
    eval_method = config.build()

    processing_frames = (
        samples.media_type == fom.VIDEO
        and pred_field.startswith(samples._FRAMES_PREFIX)
    )

    matches = []
    logger.info("Evaluating detections...")
    with fou.ProgressBar() as pb:
        for sample in pb(samples.select_fields([gt_field, pred_field])):
            if processing_frames:
                images = sample.frames.values()
            else:
                images = [sample]

            sample_tp = 0
            sample_fp = 0
            sample_fn = 0
            for image in images:
                gts = image[gt_field]
                preds = image[pred_field]
                image_matches = eval_method.evaluate_image(
                    gts, preds, eval_key=eval_key
                )
                matches.extend(image_matches)
                tp, fp, fn = _tally_matches(image_matches)
                sample_tp += tp
                sample_fp += fp
                sample_fn += fn

            if eval_key is not None:
                sample["%s_tp" % eval_key] = sample_tp
                sample["%s_fp" % eval_key] = sample_fp
                sample["%s_fn" % eval_key] = sample_fn
                sample.save()

    if eval_key is not None:
        _record_eval_info(samples, eval_key, pred_field, gt_field, config)

    return DetectionResults(matches, classes=classes, missing=missing)


def clear_detection_evaluation(samples, eval_key):
    """Clears the evaluation results generated by running
    :meth:`evaluate_detections` with the given ``eval_key`` from the samples.

    Args:
        samples: a :class:`fiftyone.core.collections.SampleCollection`
        eval_key: the ``eval_key`` value for the evaluation
    """
    pred_field, gt_field, _ = _get_eval_info(samples, eval_key)

    pred_field, is_frame_field = samples._handle_frame_field(pred_field)
    gt_field, _ = samples._handle_frame_field(gt_field)

    fields = [
        "%s.detections.%s_id" % (pred_field, eval_key),
        "%s.detections.%s_iou" % (pred_field, eval_key),
        "%s.detections.%s_id" % (gt_field, eval_key),
        "%s.detections.%s_iou" % (gt_field, eval_key),
    ]

    if is_frame_field:
        samples.delete_frame_fields(fields)
    else:
        samples.delete_sample_fields(fields)

    samples.delete_sample_fields(
        ["%s_tp" % eval_key, "%s_fp" % eval_key, "%s_fn" % eval_key]
    )

    _delete_eval_info(samples, eval_key)


class DetectionResults(ClassificationResults):
    """Class that stores the results of a detection evaluation.

    Args:
        matches: a list of ``(gt_label, pred_label)`` matches. Either label can
            be ``None`` to indicate an unmatched object
        classes (None): the list of possible classes. If not provided, the
            observed ground truth/predicted labels are used
        missing ("none"): a missing label string. Any unmatched objects are
            given this label for evaluation purposes
    """

    def __init__(self, matches, classes=None, missing="none"):
        ytrue, ypred = zip(*matches)
        super().__init__(ytrue, ypred, None, classes=classes, missing=missing)


def _parse_config(config, method, **kwargs):
    if config is None:
        if method is None:
            method = "coco"

        config = _get_default_config(method)

    for k, v in kwargs.items():
        setattr(config, k, v)

    return config


def _get_default_config(method):
    if method == "coco":
        from .coco import COCOEvaluationConfig

        return COCOEvaluationConfig()

    raise ValueError("Unsupported evaluation method '%s'" % method)


def _tally_matches(matches):
    tp = 0
    fp = 0
    fn = 0
    for gt_label, pred_label in matches:
        if gt_label is None:
            fp += 1
        elif pred_label is None:
            fn += 1
        else:
            tp += 1

    return tp, fp, fn
